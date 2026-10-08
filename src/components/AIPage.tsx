import { useEffect, useRef, useState, type CSSProperties } from "react"

type Attachment = { name: string; type: "image" | "text"; data: string }
type Message = { role: "user" | "assistant"; content: string; model?: string; attachments?: Attachment[] }
type Chat = { id: string; title: string; messages: Message[] }
type Model = { id: string; title: string; provider: string; category: string; vision: boolean }
const personalities = ["general", "coder", "professional", "friend", "femboy"]
const prompts = [
  { title: "Build something", prompt: "Help me plan a small coding project for this weekend." },
  { title: "Find the right words", prompt: "Help me write an introduction for my personal website." },
  { title: "Follow your curiosity", prompt: "Explain how web proxies work, with a simple example." },
  { title: "Explore an idea", prompt: "Let's brainstorm something creative. Ask me about my interests." },
]
function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = { spark: "m12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm7 12 1 3 3 1-3 1-1 3-1-3-3-1 3-1ZM4 2v4M2 4h4", plus: "M12 5v14M5 12h14", chat: "M4 4h16v13H8l-4 4Z", arrow: "M12 19V5m-6 6 6-6 6 6", back: "m14 5-7 7 7 7", trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7", copy: "M9 9h11v11H9ZM5 15H3V3h12v2", search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0", menu: "M4 6h16M4 12h16M4 18h16", attach: "m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9m-5 13 8-8" }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.spark} /></svg>
}
function readChats(): Chat[] {
  try {
    const data = JSON.parse(localStorage.getItem("caffeine-ai-chats") || "[]")
    return Array.isArray(data) ? data.filter(chat => typeof chat.id === "string" && typeof chat.title === "string" && Array.isArray(chat.messages) && chat.messages.every((message: Message) => ["user", "assistant"].includes(message.role) && typeof message.content === "string")).slice(0, 50) : []
  } catch { return [] }
}
function wireMessage(message: Message) {
  const documents = message.attachments?.filter(file => file.type === "text").map(file => `\n\nAttached file: ${file.name}\n${file.data}`).join("") || ""
  const text = message.content + documents
  const images = message.attachments?.filter(file => file.type === "image") || []
  return { role: message.role, content: images.length ? [{ type: "text", text: text || "Describe the attached image." }, ...images.map(file => ({ type: "image_url", image_url: { url: file.data } }))] : text }
}
async function imageAttachment(file: File): Promise<Attachment> {
  const image = await createImageBitmap(file)
  try {
    const canvas = document.createElement("canvas")
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height))
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale))
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL("image/jpeg", .8)
    if (data.length > 1500000) throw new Error("Image is too large. Choose a smaller image.")
    return { name: file.name, type: "image", data }
  } finally { image.close() }
}
export default function AIPage({ onBack, wallpaper, video, accent }: { onBack: () => void; wallpaper: string; video: string; accent: string }) {
  const [chats, setChats] = useState<Chat[]>(readChats)
  const [activeId, setActiveId] = useState("")
  const [models, setModels] = useState<Model[]>([])
  const [model, setModel] = useState("")
  const [personality, setPersonality] = useState("general")
  const [draft, setDraft] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copied, setCopied] = useState(-1)
  const controller = useRef<AbortController | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const current = chats.find(chat => chat.id === activeId)
  const messages = current?.messages || []
  const selected = models.find(item => item.id === model)
  useEffect(() => {
    const abort = new AbortController()
    fetch("/api/ai/models", { signal: abort.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Models unavailable.")
      const sorted: Model[] = data.models.sort((first: Model, second: Model) => first.title.localeCompare(second.title))
      setModels(sorted); setModel(sorted.find(item => item.id.includes("llama-3.3-70b"))?.id || sorted[0]?.id || "")
    }).catch(err => { if (!abort.signal.aborted) setError(err.message) })
    return () => { abort.abort(); controller.current?.abort() }
  }, [])
  useEffect(() => { try { localStorage.setItem("caffeine-ai-chats", JSON.stringify(chats)) } catch { setError("History storage is full. Delete older chats to save new conversations.") } }, [chats])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length, busy])
  function newChat() { controller.current?.abort(); setBusy(false); setActiveId(""); setDraft(""); setAttachments([]); setError(""); setMobileOpen(false); textarea.current?.focus() }
  async function attach(files: FileList | File[] | null) {
    if (!files || uploading || busy) return
    if (attachments.length + files.length > 4) { setError("Attach up to four files."); return }
    setUploading(true); setError("")
    try {
      const added = await Promise.all(Array.from(files).map(async file => {
        if (file.size > 10 * 1024 * 1024) throw new Error("Files must be smaller than 10 MB.")
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return imageAttachment(file)
        if (!/\.(txt|md|json|csv|js|jsx|ts|tsx|py|html|css|xml|yaml|yml|sql|sh|log|rs|go|java|c|cpp|h)$/i.test(file.name) && !file.type.startsWith("text/")) throw new Error("Choose an image, text file, or code file.")
        if (file.size > 64000) throw new Error("Text files must be smaller than 64 KB.")
        return { name: file.name, type: "text" as const, data: await file.text() }
      }))
      setAttachments(previous => [...previous, ...added])
    } catch (err) { setError(err instanceof Error ? err.message : "Could not attach file.") }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = "" }
  }
  async function send() {
    const prompt = draft.trim()
    if ((!prompt && !attachments.length) || busy || uploading || !selected) return
    if (!selected.vision && [...messages.flatMap(message => message.attachments || []), ...attachments].some(file => file.type === "image")) { setError("Choose a model marked Image support for this conversation."); return }
    const id = activeId || crypto.randomUUID()
    const next: Message[] = [...messages, { role: "user", content: prompt || "Describe the attached files.", attachments }]
    if (next.length > 60) { setError("Start a new chat to continue."); return }
    const attached = attachments
    setChats(previous => current ? previous.map(chat => chat.id === id ? { ...chat, messages: next } : chat) : [{ id, title: (prompt || attachments[0]?.name || "New chat").slice(0, 42), messages: next }, ...previous].slice(0, 50))
    setActiveId(id); setDraft(""); setAttachments([]); setError(""); setBusy(true)
    const abort = new AbortController(); controller.current = abort
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, personality, messages: next.map(wireMessage) }), signal: abort.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not send your message.")
      if (!abort.signal.aborted) setChats(previous => previous.map(chat => chat.id === id ? { ...chat, messages: [...next, { role: "assistant", content: data.content, model: data.model }] } : chat))
    } catch (err) {
      setChats(previous => previous.map(chat => chat.id === id ? { ...chat, messages: next.slice(0, -1) } : chat))
      if (controller.current === abort) { setDraft(prompt); setAttachments(attached); if (!abort.signal.aborted) setError(err instanceof Error ? err.message : "Request failed.") }
    } finally { if (controller.current === abort) { setBusy(false); controller.current = null } }
  }
  return <div className="ai-workspace" style={{ "--ai-accent": accent, "--ai-wallpaper": wallpaper ? `url(${JSON.stringify(wallpaper)})` : "none" } as CSSProperties}>
    <aside className={`ai-sidebar ${mobileOpen ? "is-open" : ""}`}>
      <button className="ai-brand" onClick={onBack}><span className="ai-brand-mark"><Glyph name="spark" size={22} /></span><span>caffeine<span className="ai-brand-ai">ai</span></span></button>
      <button className="ai-new-chat" onClick={newChat}><Glyph name="plus" />New chat<span>↗</span></button>
      <div className="ai-search"><Glyph name="search" size={15} /><input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="ai-sidebar-heading">CONVERSATIONS <span>{chats.length.toString().padStart(2, "0")}</span></div>
      <div className="ai-history">{chats.filter(chat => chat.title.toLowerCase().includes(query.toLowerCase())).map(chat => <div className={`ai-history-row ${chat.id === activeId ? "selected" : ""}`} key={chat.id}><button disabled={busy} onClick={() => { setActiveId(chat.id); setDraft(""); setAttachments([]); setError(""); setMobileOpen(false) }}><Glyph name="chat" size={15} /><span>{chat.title}</span></button><button className="ai-delete" disabled={busy} aria-label={`Delete ${chat.title}`} onClick={() => { setChats(previous => previous.filter(item => item.id !== chat.id)); if (activeId === chat.id) newChat() }}><Glyph name="trash" size={14} /></button></div>)}{!chats.length && <div className="ai-history-empty"><Glyph name="chat" size={25} /><p>Your next idea starts here.</p></div>}</div>
      <div className="ai-sidebar-bottom"><div className="ai-private">History stays on this device.</div><button className="ai-back" onClick={onBack}><Glyph name="back" size={15} />Back to browser</button></div>
    </aside>
    <section className="ai-main">
      {video && <video className="ai-background-video" src={video} autoPlay muted loop playsInline />}
      <header className="ai-topbar"><div className="ai-topbar-left"><button className="ai-mobile-toggle" aria-label="Toggle conversations" onClick={() => setMobileOpen(!mobileOpen)}><Glyph name="menu" /></button><span className="ai-section-title">Your AI space</span></div><div className="ai-powered"><span className={models.length ? "ai-status-dot" : "ai-status-dot offline"} />{models.length ? `${models.length} models` : "Offline"}</div></header>
      <div className="ai-content">
        {!messages.length ? <div className="ai-welcome"><div className="ai-hero-symbol"><Glyph name="spark" size={40} /></div><h1>What’s on your mind<span>?</span></h1><p>A little help with your next big idea.</p><div className="ai-prompt-grid">{prompts.map(item => <button className="ai-prompt" key={item.title} onClick={() => { setDraft(item.prompt); textarea.current?.focus() }}><Glyph name="spark" size={18} /><strong>{item.title}</strong><span className="ai-prompt-arrow">↗</span></button>)}</div></div> : <div className="ai-messages" aria-live="polite">{messages.map((message, index) => <article className={`ai-message ${message.role}`} key={index}><div className="ai-message-avatar">{message.role === "assistant" ? <Glyph name="spark" /> : "Y"}</div><div className="ai-message-body"><div className="ai-message-label">{message.role === "assistant" ? "caffeine ai" : "You"}{message.model && <span>{message.model}</span>}</div><div className="ai-message-text">{message.content}</div>{message.attachments && <div className="ai-message-files">{message.attachments.map((file, fileIndex) => file.type === "image" ? <img key={fileIndex} src={file.data} alt={file.name} /> : <span key={fileIndex}><Glyph name="attach" size={13} />{file.name}</span>)}</div>}{message.role === "assistant" && <button className="ai-copy" onClick={async () => { try { await navigator.clipboard.writeText(message.content); setCopied(index) } catch { setError("Could not copy the answer.") } }}><Glyph name="copy" size={13} />{copied === index ? "Copied" : "Copy"}</button>}</div></article>)}{busy && <div className="ai-thinking"><Glyph name="spark" /><span>Thinking<span className="ai-thinking-dots"> …</span></span></div>}<div ref={bottom} /></div>}
      </div>
      <div className="ai-composer-area">
        {error && <div className="ai-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
        <form className="ai-composer" onSubmit={event => { event.preventDefault(); void send() }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void attach(event.dataTransfer.files) }}>
          {!!attachments.length && <div className="ai-attachments">{attachments.map((file, index) => <div className="ai-attachment" key={index}>{file.type === "image" ? <img src={file.data} alt="" /> : <Glyph name="attach" size={14} />}<span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(previous => previous.filter((_, position) => position !== index))}>×</button></div>)}</div>}
          <textarea ref={textarea} aria-label="Message Caffeine AI" placeholder="Ask anything…" value={draft} maxLength={20000} rows={2} onChange={event => setDraft(event.target.value)} onPaste={event => { const files = event.clipboardData.files; if (files.length) { event.preventDefault(); void attach(files) } }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} />
          <div className="ai-composer-bottom"><div className="ai-model-picker"><Glyph name="spark" size={14} /><select aria-label="Select AI model" value={model} disabled={busy || !models.length} onChange={event => setModel(event.target.value)}>{!models.length && <option value="">No models available</option>}{["general", "coding", "unfiltered"].map(category => <optgroup key={category} label={category === "general" ? "General use" : category === "coding" ? "Coding" : "Unfiltered"}>{models.filter(item => item.category === category).map(item => <option value={item.id} key={item.id}>{item.title} · {item.provider}{item.vision ? " · Image support" : ""}</option>)}{!models.some(item => item.category === category) && <option disabled>{category === "unfiltered" ? "No provider-labelled unfiltered models" : "No models available"}</option>}</optgroup>)}</select></div><div className="ai-send-wrap"><button className="ai-attach-button" type="button" disabled={uploading || busy} aria-label="Attach images or text files" title="Attach images or text files" onClick={() => fileInput.current?.click()}><Glyph name="attach" /></button><input className="hidden" ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,text/*,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.yaml,.yml,.sql,.rs,.go,.java,.c,.cpp" onChange={event => void attach(event.target.files)} />{busy ? <button type="button" className="ai-send ai-stop" aria-label="Stop generation" onClick={() => controller.current?.abort()}>■</button> : <button className="ai-send" type="submit" disabled={(!draft.trim() && !attachments.length) || uploading || !model} aria-label="Send message"><Glyph name="arrow" size={20} /></button>}</div></div>
          <div className="ai-personalities"><span>Personality</span>{personalities.map(item => <button type="button" disabled={busy} key={item} className={personality === item ? "selected" : ""} aria-pressed={personality === item} onClick={() => setPersonality(item)}>{item}</button>)}</div>
        </form>
        <div className="ai-composer-foot"><span>AI can make mistakes.</span><span>{selected?.provider || ""}{selected?.vision ? " · Image support" : ""}</span></div>
      </div>
    </section>
  </div>
}

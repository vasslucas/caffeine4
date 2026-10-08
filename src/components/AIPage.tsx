import { useEffect, useRef, useState } from "react"

type Message = { role: "user" | "assistant"; content: string; model?: string }
type Chat = { id: string; title: string; messages: Message[]; updated: number }
type Model = { id: string; owner?: string; context?: number }
const presets: Model[] = [{ id: "llama-3.3-70b-versatile", owner: "Meta" }, { id: "llama-3.1-8b-instant", owner: "Meta" }, { id: "openai/gpt-oss-120b", owner: "OpenAI" }, { id: "openai/gpt-oss-20b", owner: "OpenAI" }]
const prompts = [
  { icon: "code", title: "Build something", description: "Turn an idea into working code", prompt: "Help me build a simple personal website. Where should I start?" },
  { icon: "pen", title: "Find the right words", description: "A first draft, a fresh perspective", prompt: "Help me write a short, engaging introduction for my personal website." },
  { icon: "bulb", title: "Follow your curiosity", description: "Make the complicated click", prompt: "Explain how web proxies work in simple terms, with an example." },
  { icon: "spark", title: "Think outside the tab", description: "Brainstorm your next big thing", prompt: "Give me five creative ideas for a small coding project I can build this weekend." },
]
function label(id: string) {
  return ({ "llama-3.3-70b-versatile": "Llama 3.3 70B", "llama-3.1-8b-instant": "Llama 3.1 8B", "openai/gpt-oss-120b": "GPT OSS 120B", "openai/gpt-oss-20b": "GPT OSS 20B" } as Record<string, string>)[id] || id
}
function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = { spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z", plus: "M12 5v14M5 12h14", chat: "M4 4h16v13H8l-4 4Z", arrow: "M12 19V5m-6 6 6-6 6 6", back: "m14 5-7 7 7 7", code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16", pen: "m4 16 11-11 4 4L8 20H4Zm9-9 4 4", bulb: "M9 18h6m-6 3h6M8 15a6 6 0 1 1 8 0l-1 3H9Z", trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7", shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6", copy: "M9 9h11v11H9ZM5 15H3V3h12v2", search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0", menu: "M4 6h16M4 12h16M4 18h16" }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.spark} /></svg>
}
function readChats(): Chat[] {
  try {
    const value = JSON.parse(localStorage.getItem("caffeine-ai-chats") || "[]")
    return Array.isArray(value) ? value.filter(chat => typeof chat.id === "string" && typeof chat.title === "string" && Array.isArray(chat.messages) && chat.messages.every((message: Message) => ["user", "assistant"].includes(message.role) && typeof message.content === "string")).slice(0, 50) : []
  } catch { return [] }
}

export default function AIPage({ onBack }: { onBack: () => void }) {
  const [chats, setChats] = useState<Chat[]>(readChats)
  const [activeId, setActiveId] = useState("")
  const [models, setModels] = useState<Model[]>(presets)
  const [model, setModel] = useState(presets[0].id)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [connected, setConnected] = useState(false)
  const [query, setQuery] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [copied, setCopied] = useState(-1)
  const controller = useRef<AbortController | null>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const current = chats.find(chat => chat.id === activeId)
  const messages = current?.messages || []
  const selected = models.find(item => item.id === model)
  useEffect(() => {
    const abort = new AbortController()
    fetch("/api/ai/models", { signal: abort.signal }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Models unavailable.")
      if (!data.models?.length) throw new Error("No chat models available.")
      const sorted = [...data.models].sort((first: Model, second: Model) => {
        const firstRank = presets.findIndex(item => item.id === first.id)
        const secondRank = presets.findIndex(item => item.id === second.id)
        return (firstRank < 0 ? 99 : firstRank) - (secondRank < 0 ? 99 : secondRank)
      })
      setModels(sorted); setModel(previous => sorted.some((item: Model) => item.id === previous) ? previous : sorted[0].id); setConnected(true)
    }).catch(err => { if (!abort.signal.aborted) setError(err.message || "Cannot reach the AI server.") })
    return () => { abort.abort(); controller.current?.abort() }
  }, [])
  useEffect(() => { try { localStorage.setItem("caffeine-ai-chats", JSON.stringify(chats.slice(0, 50))) } catch { setError("Device storage is full. Delete old chats to make space.") } }, [chats])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length, busy])
  function newChat() { controller.current?.abort(); setBusy(false); setActiveId(""); setDraft(""); setError(""); setMobileOpen(false); textarea.current?.focus() }
  async function send() {
    const prompt = draft.trim()
    if (!prompt || busy) return
    const id = activeId || crypto.randomUUID()
    const next: Message[] = [...messages, { role: "user", content: prompt }]
    if (next.length > 60) { setError("Start a new chat to continue — this conversation reached its message limit."); return }
    setChats(previous => current ? previous.map(chat => chat.id === id ? { ...chat, messages: next, updated: Date.now() } : chat) : [{ id, title: prompt.slice(0, 42), messages: next, updated: Date.now() }, ...previous].slice(0, 50))
    setActiveId(id); setDraft(""); setError(""); setBusy(true)
    const abort = new AbortController(); controller.current = abort
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: next.map(({ role, content }) => ({ role, content })) }), signal: abort.signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not send your message.")
      if (!abort.signal.aborted) setChats(previous => previous.map(chat => chat.id === id ? { ...chat, messages: [...next, { role: "assistant", content: data.content, model: data.model }], updated: Date.now() } : chat))
    } catch (err) {
      setChats(previous => previous.map(chat => chat.id === id ? { ...chat, messages: next.slice(0, -1) } : chat))
      if (!abort.signal.aborted) { setError(err instanceof Error ? err.message : "Request failed."); setDraft(prompt) }
    } finally { if (controller.current === abort) { setBusy(false); controller.current = null } }
  }
  return <div className="ai-workspace">
    <aside className={`ai-sidebar ${mobileOpen ? "is-open" : ""}`}>
      <button className="ai-brand" onClick={onBack}><span className="ai-brand-mark"><Glyph name="spark" size={22} /></span><span>caffeine<span className="ai-brand-ai">ai</span></span></button>
      <button className="ai-new-chat" onClick={newChat}><Glyph name="plus" />New chat<span>↗</span></button>
      <div className="ai-search"><Glyph name="search" size={15} /><input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="ai-sidebar-heading">YOUR CONVERSATIONS <span>{chats.length.toString().padStart(2, "0")}</span></div>
      <div className="ai-history">
        {chats.filter(chat => chat.title.toLowerCase().includes(query.toLowerCase())).map(chat => <div className={`ai-history-row ${chat.id === activeId ? "selected" : ""}`} key={chat.id}><button disabled={busy} onClick={() => { setActiveId(chat.id); setDraft(""); setError(""); setMobileOpen(false) }}><Glyph name="chat" size={15} /><span>{chat.title}</span></button><button className="ai-delete" disabled={busy} aria-label={`Delete ${chat.title}`} onClick={() => { setChats(previous => previous.filter(item => item.id !== chat.id)); if (activeId === chat.id) newChat() }}><Glyph name="trash" size={14} /></button></div>)}
        {!chats.length && <div className="ai-history-empty"><Glyph name="chat" size={25} /><p>A little room for big ideas.</p><span>Your conversations will appear here.</span></div>}
        {!!chats.length && !chats.some(chat => chat.title.toLowerCase().includes(query.toLowerCase())) && <p className="ai-no-results">No conversations found.</p>}
      </div>
      <div className="ai-sidebar-bottom"><div className="ai-private"><Glyph name="shield" /><div>Just on this device<span>Chat history is saved locally.</span></div></div><button className="ai-back" onClick={onBack}><Glyph name="back" size={15} />Back to browser<Glyph name="arrow" size={14} /></button></div>
    </aside>
    <section className="ai-main">
      <header className="ai-topbar"><div className="ai-topbar-left"><button className="ai-mobile-toggle" aria-label="Toggle conversations" onClick={() => setMobileOpen(!mobileOpen)}><Glyph name="menu" /></button><span className="ai-section-title">AI workspace</span><span className="ai-beta">BETA</span></div><div className="ai-powered"><span className={connected ? "ai-status-dot" : "ai-status-dot offline"} />{connected ? "Powered by Groq" : "Groq · not connected"}<span className="ai-lightning">ϟ</span></div></header>
      <div className="ai-content">
        {!messages.length ? <div className="ai-welcome"><div className="ai-hero-symbol"><Glyph name="spark" size={40} /><span className="ai-symbol-small">✦</span></div><div className="ai-eyebrow">LESS FRICTION. MORE POSSIBILITY.</div><h1>A fresh thought starts here<span>.</span></h1><p>Your curiosity, supercharged. Write, build, explore —<br className="ai-desktop-break" /> with the right model for whatever’s on your mind.</p><div className="ai-prompt-grid">{prompts.map(item => <button className="ai-prompt" key={item.title} onClick={() => { setDraft(item.prompt); textarea.current?.focus() }}><Glyph name={item.icon} size={21} /><strong>{item.title}</strong><span>{item.description}</span><span className="ai-prompt-arrow">↗</span></button>)}</div><div className="ai-model-note"><span className="ai-mini-stack">⌘</span>Different minds. One workspace.<span>Switch models anytime.</span></div></div> : <div className="ai-messages" aria-live="polite">{messages.map((message, index) => <article className={`ai-message ${message.role}`} key={index}><div className="ai-message-avatar">{message.role === "assistant" ? <Glyph name="spark" /> : "Y"}</div><div className="ai-message-body"><div className="ai-message-label">{message.role === "assistant" ? "caffeine ai" : "You"}{message.model && <span>{label(message.model)}</span>}</div><div className="ai-message-text">{message.content}</div>{message.role === "assistant" && <button className="ai-copy" onClick={async () => { try { await navigator.clipboard.writeText(message.content); setCopied(index) } catch { setError("Could not copy. Select the answer and copy it manually.") } }}><Glyph name="copy" size={13} />{copied === index ? "Copied" : "Copy answer"}</button>}</div></article>)}{busy && <div className="ai-thinking"><Glyph name="spark" /><span>Thinking with {label(model)}<span className="ai-thinking-dots"> …</span></span></div>}<div ref={bottom} /></div>}
      </div>
      <div className="ai-composer-area">
        {error && <div className="ai-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
        <form className="ai-composer" onSubmit={event => { event.preventDefault(); void send() }}><textarea ref={textarea} aria-label="Message Caffeine AI" placeholder="What's on your mind?" value={draft} maxLength={20000} rows={2} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} /><div className="ai-composer-bottom"><div className="ai-model-picker"><Glyph name="spark" size={14} /><select aria-label="Select AI model" value={model} disabled={busy} onChange={event => setModel(event.target.value)}>{models.map(item => <option value={item.id} key={item.id}>{label(item.id)}</option>)}</select><span className="ai-model-speed">{model.includes("instant") ? "FAST" : "VERSATILE"}</span></div><div className="ai-send-wrap"><span>Shift + Enter for a new line</span>{busy ? <button type="button" className="ai-send ai-stop" aria-label="Stop generation" onClick={() => controller.current?.abort()}>■</button> : <button className="ai-send" type="submit" disabled={!draft.trim()} aria-label="Send message"><Glyph name="arrow" size={20} /></button>}</div></div></form>
        <div className="ai-composer-foot"><span>AI can make mistakes. Stay curious, double-check.</span><span>{selected?.owner || "Meta"} <span className="ai-foot-dot">·</span> Groq inference</span></div>
      </div>
    </section>
  </div>
}

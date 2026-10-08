import { useEffect, useState } from "react"

export const widgetCatalog = [
  {
    kind: "notes",
    name: "Sticky note",
    description: "A thought worth keeping.",
    symbol: "✎",
  },
  {
    kind: "tasks",
    name: "Tiny to-do",
    description: "Little steps, big things.",
    symbol: "✓",
  },
  {
    kind: "focus",
    name: "Focus timer",
    description: "25 minutes just for you.",
    symbol: "◷",
  },
  {
    kind: "breathing",
    name: "Take a breath",
    description: "A moment to slow down.",
    symbol: "◌",
  },
  {
    kind: "quote",
    name: "Daily thought",
    description: "A little perspective.",
    symbol: "“",
  },
  {
    kind: "calendar",
    name: "Mini calendar",
    description: "Your month at a glance.",
    symbol: "▦",
  },
  {
    kind: "worldclock",
    name: "World clocks",
    description: "London, Tokyo, New York.",
    symbol: "◎",
  },
  {
    kind: "countdown",
    name: "Countdown",
    description: "Something to look forward to.",
    symbol: "↗",
  },
  {
    kind: "calculator",
    name: "Quick math",
    description: "No new tab needed.",
    symbol: "±",
  },
  {
    kind: "water",
    name: "Stay hydrated",
    description: "One glass at a time.",
    symbol: "♧",
  },
  {
    kind: "mood",
    name: "Mood check-in",
    description: "How are you, really?",
    symbol: "♡",
  },
  {
    kind: "dice",
    name: "Roll the dice",
    description: "Leave it up to chance.",
    symbol: "⚄",
  },
  {
    kind: "links",
    name: "Quick link",
    description: "One favorite destination.",
    symbol: "↗",
  },
  {
    kind: "text",
    name: "Text card",
    description: "Your words, your space.",
    symbol: "Aa",
  },
  {
    kind: "affirmation",
    name: "Gentle reminder",
    description: "You’re doing just fine.",
    symbol: "✧",
  },
  {
    kind: "progress",
    name: "Day in progress",
    description: "Make room for a pause.",
    symbol: "◐",
  },
] as const

function readValue(key: string) {
  try {
    return localStorage.getItem(key) || ""
  } catch {
    return ""
  }
}

export default function ExtraWidget({
  kind,
  storageKey,
  now,
  text,
  navigate,
}: {
  kind: string
  storageKey: string
  now: Date
  text: string
  navigate: (url: string) => void
}) {
  const [value, setValue] = useState(() => readValue(storageKey))
  const [seconds, setSeconds] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [dice, setDice] = useState(1)
  const [math, setMath] = useState({ first: "", second: "", operation: "+" })
  useEffect(() => {
    if (!running) return
    const timer = setInterval(
      () =>
        setSeconds((previous) => {
          if (previous <= 1) {
            setRunning(false)
            return 0
          }
          return previous - 1
        }),
      1000,
    )
    return () => clearInterval(timer)
  }, [running])
  function save(next: string) {
    setValue(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {}
  }
  const definition = widgetCatalog.find((item) => item.kind === kind)
  const title = text || definition?.name || "Widget"
  let content
  if (kind === "notes")
    content = (
      <textarea
        aria-label="Note"
        placeholder="A small thought…"
        value={value}
        onChange={(event) => save(event.target.value)}
      />
    )
  else if (kind === "tasks")
    content = (
      <div className="widget-tasks">
        <textarea
          aria-label="Tasks, one per line"
          placeholder={"Write a task\nOne per line"}
          value={value}
          onChange={(event) => save(event.target.value)}
        />
        {value
          .split("\n")
          .filter(Boolean)
          .map((task, index) => (
            <label key={`${index}:${task}`}>
              <input
                type="checkbox"
                checked={task.startsWith("✓ ")}
                onChange={() => {
                  const tasks = value.split("\n").filter(Boolean)
                  tasks[index] = task.startsWith("✓ ")
                    ? task.slice(2)
                    : `✓ ${task}`
                  save(tasks.join("\n"))
                }}
              />
              <span>{task.replace(/^✓ /, "")}</span>
            </label>
          ))}
      </div>
    )
  else if (kind === "focus")
    content = (
      <>
        <strong className="widget-large">
          {Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}
          :{(seconds % 60).toString().padStart(2, "0")}
        </strong>
        <div className="widget-button-row">
          <button
            onClick={() => {
              if (seconds === 0) setSeconds(1500)
              setRunning(!running)
            }}
          >
            {running ? "Pause" : seconds === 0 ? "Again?" : "Start focus"}
          </button>
          <button
            onClick={() => {
              setRunning(false)
              setSeconds(1500)
            }}
          >
            Reset
          </button>
        </div>
      </>
    )
  else if (kind === "breathing")
    content = (
      <div className="breathing-orb">
        <span>Inhale · exhale</span>
      </div>
    )
  else if (kind === "quote") {
    const quotes = [
      "Almost everything will work again if you unplug it for a few minutes. Including you.",
      "There is no hurry. Small steps still move you forward.",
      "Make something good. Then make yourself a cup of tea.",
      "You do not have to be perfect to begin.",
    ]
    content = (
      <blockquote>
        {quotes[Math.floor(now.getTime() / 86400000) % quotes.length]}
      </blockquote>
    )
  } else if (kind === "calendar") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    content = (
      <>
        <p>
          {now.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </p>
        <div className="mini-calendar">
          {"SMTWTFS".split("").map((day, index) => (
            <b key={index}>{day}</b>
          ))}
          {Array.from({ length: start }, (_, index) => (
            <span key={`empty:${index}`} />
          ))}
          {Array.from({ length: days }, (_, index) => (
            <span
              className={index + 1 === now.getDate() ? "today" : ""}
              key={index}
            >
              {index + 1}
            </span>
          ))}
        </div>
      </>
    )
  } else if (kind === "worldclock")
    content = (
      <div className="world-clocks">
        {[
          ["London", "Europe/London"],
          ["Tokyo", "Asia/Tokyo"],
          ["New York", "America/New_York"],
        ].map(([city, zone]) => (
          <div key={city}>
            <span>{city}</span>
            <b>
              {now.toLocaleTimeString("en-GB", {
                timeZone: zone,
                hour: "2-digit",
                minute: "2-digit",
              })}
            </b>
          </div>
        ))}
      </div>
    )
  else if (kind === "countdown")
    content = (
      <>
        <input
          aria-label="Countdown date"
          type="date"
          value={value}
          onChange={(event) => save(event.target.value)}
        />
        <strong className="widget-large">
          {value
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(`${value}T00:00:00`).getTime() - now.getTime()) /
                    86400000,
                ),
              )
            : "—"}
        </strong>
        <small>days to look forward to</small>
      </>
    )
  else if (kind === "calculator") {
    const first = Number(math.first),
      second = Number(math.second)
    const result =
      math.operation === "+"
        ? first + second
        : math.operation === "−"
          ? first - second
          : math.operation === "×"
            ? first * second
            : second === 0
              ? "Cannot divide by zero"
              : first / second
    content = (
      <>
        <div className="widget-math">
          <input
            aria-label="First number"
            type="number"
            value={math.first}
            onChange={(event) =>
              setMath({ ...math, first: event.target.value })
            }
          />
          <select
            aria-label="Operation"
            value={math.operation}
            onChange={(event) =>
              setMath({ ...math, operation: event.target.value })
            }
          >
            {["+", "−", "×", "÷"].map((operation) => (
              <option key={operation}>{operation}</option>
            ))}
          </select>
          <input
            aria-label="Second number"
            type="number"
            value={math.second}
            onChange={(event) =>
              setMath({ ...math, second: event.target.value })
            }
          />
        </div>
        <strong className="widget-result">
          {math.first && math.second ? result : "…"}
        </strong>
      </>
    )
  } else if (kind === "water") {
    const today = now.toLocaleDateString("en-CA")
    const [date, storedCount] = value.split("|")
    const count = date === today ? Number(storedCount) || 0 : 0
    content = (
      <>
        <strong className="widget-large">
          {count}
          <small> / 8</small>
        </strong>
        <p>glasses today</p>
        <div className="widget-button-row">
          <button onClick={() => save(`${today}|${Math.min(8, count + 1)}`)}>
            + A glass
          </button>
          <button onClick={() => save(`${today}|0`)}>Reset</button>
        </div>
      </>
    )
  } else if (kind === "mood")
    content = (
      <>
        <div className="mood-options">
          {["☀", "♡", "☁", "☂"].map((mood, index) => (
            <button
              key={mood}
              aria-label={["Happy", "Loved", "Quiet", "Low"][index]}
              aria-pressed={value === mood}
              onClick={() => save(mood)}
            >
              {mood}
            </button>
          ))}
        </div>
        <small>
          {value ? "Noted. Be kind to yourself." : "All feelings are welcome."}
        </small>
      </>
    )
  else if (kind === "dice")
    content = (
      <>
        <strong className="widget-large">
          {["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][dice - 1]}
        </strong>
        <button onClick={() => setDice(Math.floor(Math.random() * 6) + 1)}>
          Roll again
        </button>
      </>
    )
  else if (kind === "links")
    content = (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (value.trim()) navigate(value)
        }}
      >
        <input
          aria-label="Quick link URL"
          placeholder="example.com"
          value={value}
          onChange={(event) => save(event.target.value)}
        />
        <button type="submit">Take me there ↗</button>
      </form>
    )
  else if (kind === "progress") {
    const progress = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100
    content = (
      <>
        <strong className="widget-large">
          {Math.round(progress)}
          <small>%</small>
        </strong>
        <progress value={progress} max={100} />
        <small>Today is still yours.</small>
      </>
    )
  } else if (kind === "affirmation")
    content = (
      <blockquote>
        You belong here.
        <br />
        Take up a little space. ♡
      </blockquote>
    )
  else
    content = (
      <textarea
        aria-label="Custom text"
        value={value}
        placeholder="Your words. Your little corner."
        onChange={(event) => save(event.target.value)}
      />
    )
  return (
    <section className={`extra-widget extra-${kind}`}>
      <header>
        <span>{definition?.symbol}</span>
        {title}
      </header>
      {content}
    </section>
  )
}

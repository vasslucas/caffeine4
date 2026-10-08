const fonts = [
  "DM Sans",
  "Manrope",
  "Nunito",
  "Quicksand",
  "Lora",
  "Playfair Display",
  "Space Grotesk",
  "Space Mono",
  "Caveat",
  "Pacifico",
  "Bebas Neue",
  "Comfortaa",
  "Arial",
  "Verdana",
  "Trebuchet MS",
  "Tahoma",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
]

export default function FontPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (font: string) => void
}) {
  return (
    <details className="font-picker">
      <summary style={{ fontFamily: value }}>
        {value}
        <span>⌄</span>
      </summary>
      <div className="font-options" role="group" aria-label="Choose typeface">
        {fonts.map((font) => (
          <button
            type="button"
            key={font}
            aria-pressed={value === font}
            style={{ fontFamily: font }}
            onClick={(event) => {
              onChange(font)
              event.currentTarget.closest("details")?.removeAttribute("open")
            }}
          >
            {font}
            <span>{value === font ? "✓" : "Aa"}</span>
          </button>
        ))}
      </div>
    </details>
  )
}

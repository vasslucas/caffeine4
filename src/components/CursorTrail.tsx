import { useEffect, useRef } from "react"

export default function CursorTrail({ style, accent }: { style: string; accent: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (style === "none" || matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(pointer: coarse)").matches) return
    const element = canvas.current!
    const context = element.getContext("2d")!
    const particles: { x: number; y: number; life: number; size: number; drift: number }[] = []
    let frame = 0
    let previous = performance.now()
    let lastPointer = 0
    const resize = () => { const ratio = devicePixelRatio || 1; element.width = innerWidth * ratio; element.height = innerHeight * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0) }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || performance.now() - lastPointer < 22) return
      lastPointer = performance.now()
      particles.push({ x: event.clientX, y: event.clientY, life: 1, size: 3 + Math.random() * 4, drift: (Math.random() - .5) * 20 })
      if (particles.length > 70) particles.shift()
    }
    const draw = (now: number) => {
      const delta = Math.min(.05, (now - previous) / 1000); previous = now
      context.clearRect(0, 0, innerWidth, innerHeight)
      context.fillStyle = accent; context.strokeStyle = accent
      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index]
        particle.life -= delta * 1.6; particle.y += delta * 12; particle.x += delta * particle.drift
        if (particle.life <= 0) { particles.splice(index, 1); continue }
        context.globalAlpha = particle.life * .65
        const size = particle.size * particle.life
        if (style === "hearts") { context.font = `${size * 3}px sans-serif`; context.fillText("♡", particle.x, particle.y) }
        else if (style === "sparkles") { context.beginPath(); context.moveTo(particle.x - size, particle.y); context.lineTo(particle.x, particle.y - size * 2); context.lineTo(particle.x + size, particle.y); context.lineTo(particle.x, particle.y + size * 2); context.closePath(); context.fill() }
        else { context.beginPath(); context.arc(particle.x, particle.y, style === "dust" ? size * .45 : size, 0, Math.PI * 2); if (style === "bubbles") context.stroke(); else context.fill() }
      }
      context.globalAlpha = 1; frame = requestAnimationFrame(draw)
    }
    resize(); window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true }); frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); context.clearRect(0, 0, innerWidth, innerHeight) }
  }, [style, accent])
  return style === "none" ? null : <canvas className="cursor-trail" ref={canvas} aria-hidden="true" />
}

import { useEffect, useRef } from 'react'

const BAR_COUNT = 16

// Per-bar oscillation params (fixed at module load) so each bar waves with its
// own frequency/phase — producing an organic, random-looking wave rather than
// every bar rising and falling together.
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  f1: 2 + ((i * 3) % 5) * 0.7,
  f2: 3.4 + ((i * 7) % 6) * 0.55,
  p1: (i * 1.7) % (Math.PI * 2),
  p2: (i * 2.9) % (Math.PI * 2),
}))

const MIN_H = 3
const MAX_EXTRA = 38

/**
 * Voice-reactive waveform. `level` (0–1) is the live mic volume: it scales the
 * oscillation amplitude, so bars wave while the user speaks and gradually settle
 * to a flat line on silence.
 */
export function SoundWave({ level }: { level: number }) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const levelRef = useRef(level)
  levelRef.current = level

  useEffect(() => {
    let raf = 0
    let smoothLevel = 0
    const start = performance.now()

    const loop = (now: number) => {
      const t = (now - start) / 1000
      // Fast attack, slow release: amplitude rises quickly with the voice but
      // fades out gently when the user stops, so bars don't drop abruptly.
      const target = levelRef.current
      const coeff = target > smoothLevel ? 0.2 : 0.035
      smoothLevel += (target - smoothLevel) * coeff
      const amp = smoothLevel < 0.001 ? 0 : smoothLevel

      for (let i = 0; i < BAR_COUNT; i++) {
        const b = BARS[i]
        // Two layered sines → non-uniform, lively motion in 0..1.
        const osc = 0.5 + 0.5 * (0.6 * Math.sin(t * b.f1 + b.p1) + 0.4 * Math.sin(t * b.f2 + b.p2))
        const h = MIN_H + MAX_EXTRA * amp * osc
        const el = refs.current[i]
        if (el) el.style.height = `${h}px`
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="flex items-center justify-center gap-[3px] h-12">
      {BARS.map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          className="w-[3px] bg-stone-700 dark:bg-stone-300 rounded-full"
          style={{ height: `${MIN_H}px` }}
        />
      ))}
    </div>
  )
}

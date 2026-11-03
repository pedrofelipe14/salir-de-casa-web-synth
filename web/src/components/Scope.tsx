import { useEffect, useRef } from 'react'

interface Props {
  analyser: AnalyserNode | null
}

/** Live oscilloscope of the synth's output, triggered on a rising zero crossing so it holds still. */
export function Scope({ analyser }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvas.current!
    const g = c.getContext('2d')!
    const data = new Float32Array(analyser?.fftSize ?? 2048)
    let frame = 0

    const draw = () => {
      const { width, height } = c
      g.clearRect(0, 0, width, height)
      g.strokeStyle = 'rgba(168, 230, 176, 0.18)'
      g.beginPath()
      g.moveTo(0, height / 2)
      g.lineTo(width, height / 2)
      g.stroke()

      if (analyser) {
        analyser.getFloatTimeDomainData(data)
        let start = 0
        for (let i = 1; i < data.length / 2; i++) {
          if (data[i - 1] < 0 && data[i] >= 0) {
            start = i
            break
          }
        }
        const span = data.length / 2
        g.strokeStyle = '#a8e6b0'
        g.lineWidth = 2
        g.shadowColor = 'rgba(168, 230, 176, 0.6)'
        g.shadowBlur = 6
        g.beginPath()
        for (let i = 0; i < span; i++) {
          const x = (i / span) * width
          const y = height / 2 - data[start + i] * (height / 2 - 4)
          if (i === 0) g.moveTo(x, y)
          else g.lineTo(x, y)
        }
        g.stroke()
        g.shadowBlur = 0
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [analyser])

  return <canvas ref={canvas} className="scope" width={640} height={120} aria-label="Osciloscopio" role="img" />
}

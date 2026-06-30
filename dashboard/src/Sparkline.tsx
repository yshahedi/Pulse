// Dependency-free sparkline (inline SVG).
export function Sparkline({ data, width = 240, height = 40, color = '#4ade80' }: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (data.length < 2) return <svg width={width} height={height} />
  const max = Math.max(1, ...data)
  const step = width / (data.length - 1)
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="spark">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

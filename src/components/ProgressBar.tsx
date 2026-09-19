interface ProgressBarProps {
  /** 有效条数 */
  value: number
  target: number
}

export default function ProgressBar({ value, target }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  const met = value >= target
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-teal-800/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            met ? 'bg-emerald-400' : 'bg-dusk-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`mt-1 text-xs ${met ? 'text-emerald-300' : 'text-mist-400'}`}>
        {met ? '已达标，可封存' : `已完成 ${Math.round(pct)}%`}
      </p>
    </div>
  )
}

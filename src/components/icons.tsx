type IconProps = { className?: string; size?: number }

export const Mic = ({ className = "", size = 24 }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="8" y="2" width="8" height="13" rx="4" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
  </svg>
)

export const Play = ({ className = "", size = 18 }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="m8 5 11 7-11 7V5Z" />
  </svg>
)

export function Wave({ light = false }: { light?: boolean }) {
  const levels = [
    23, 48, 70, 40, 86, 58, 35, 74, 95, 52, 30, 67, 47, 90, 62, 36, 72, 44,
  ]
  return (
    <div className="flex h-12 items-center gap-1.5">
      {levels.map((height, i) => (
        <i
          key={i}
          className={`block w-1 rounded-full ${light ? "bg-white/70" : "bg-kez-blue"
            }`}
          style={{ height: `${height}%`, opacity: i === 8 ? 1 : undefined }}
        />
      ))}
    </div>
  )
}

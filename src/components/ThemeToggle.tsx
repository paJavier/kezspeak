import { useTheme } from "../lib/theme"

/** Light/dark switch. The choice is remembered on this device. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === "dark"
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`grid size-10 shrink-0 place-items-center rounded-full bg-kez-blue-light text-lg ${className}`}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  )
}

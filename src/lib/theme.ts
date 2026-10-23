import { useEffect, useState } from "react"

export type Theme = "light" | "dark"

const STORAGE_KEY = "kezspeak-theme"
const media = () => window.matchMedia?.("(prefers-color-scheme: dark)")

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" ? value : null
  } catch {
    return null // storage blocked (private mode etc.)
  }
}

/** The user's saved choice, otherwise the device setting. */
export const initialTheme = (): Theme => storedTheme() ?? (media()?.matches ? "dark" : "light")

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

/** Current theme plus a toggle that remembers the choice on this device. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Follow the device setting until the user picks a theme themselves.
  useEffect(() => {
    const query = media()
    if (!query) return
    const onChange = (e: MediaQueryListEvent) => !storedTheme() && setTheme(e.matches ? "dark" : "light")
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const toggle = () =>
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Not saved; the toggle still works for this visit.
      }
      return next
    })

  return { theme, toggle }
}

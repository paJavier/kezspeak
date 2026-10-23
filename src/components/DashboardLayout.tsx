import { useEffect, useState, type ComponentType, type ReactNode } from "react"
import ThemeToggle from "./ThemeToggle"

// The icon is an emoji string or an icon component (e.g. from lucide-react).
export type NavIcon = string | ComponentType<{ size?: number; className?: string }>
export type NavItem = [id: string, icon: NavIcon, label: string]

type Props = {
  brand: ReactNode
  workspaceLabel: string
  eyebrow: string
  title: string
  nav: NavItem[]
  isActive: (id: string) => boolean
  onNavigate: (id: string) => void
  badges?: Record<string, ReactNode>
  userName: string
  userSubtitle: string
  avatarLetter: string
  onSignOut: () => void
  children: ReactNode
}

/**
 * Shared shell for the student and tutor/admin dashboards: a fixed sidebar on
 * large screens and a slide-in drawer (opened from the header) below `lg`.
 */
export default function DashboardLayout(props: Props) {
  const { brand, workspaceLabel, eyebrow, title, nav, isActive, onNavigate, badges, userName, userSubtitle, avatarLetter, onSignOut, children } = props
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    window.addEventListener("keydown", close)
    // Stop the page behind the drawer from scrolling.
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", close)
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  const navigate = (id: string) => {
    onNavigate(id)
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
  }

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-3">
        {brand}
        <button onClick={() => setMenuOpen(false)} className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 lg:hidden" aria-label="Close menu">
          ✕
        </button>
      </div>
      <p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">{workspaceLabel}</p>
      {/* min-h-0 lets the nav scroll instead of pushing the footer off-screen. */}
      <nav className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {nav.map(([id, Icon, label]) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            aria-current={isActive(id) ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${isActive(id) ? "bg-kez-blue text-white" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
          >
            <span className="grid w-6 place-items-center text-lg">
              {typeof Icon === "string" ? Icon : <Icon size={19} />}
            </span>
            {label}
            {badges?.[id] && <b className="ml-auto rounded-full bg-kez-yellow px-2 py-0.5 text-[10px] text-kez-dark">{badges[id]}</b>}
          </button>
        ))}
      </nav>
      <div className="mt-3 shrink-0 border-t border-white/10 pt-3">
        <button onClick={() => navigate("profile")} className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 hover:bg-white/10">
          ⚙ Settings
        </button>
        <button onClick={onSignOut} className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 hover:bg-white/10">
          ↪ Log Out
        </button>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/8 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-kez-yellow font-bold text-kez-dark">{avatarLetter}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{userName}</p>
            <p className="text-[11px] text-white/45">{userSubtitle}</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-dvh bg-[#f8fbff] text-kez-dark">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-kez-dark px-3 py-5 text-white lg:flex">{sidebar}</aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-slate-950/50" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
          <aside className="relative flex h-dvh w-72 max-w-[85vw] flex-col bg-kez-dark px-3 py-5 text-white shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 lg:static lg:px-10 lg:py-5">
          <button
            onClick={() => setMenuOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-kez-blue-light text-lg text-kez-blue lg:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-kez-blue sm:text-xs">{eyebrow}</p>
            <h1 className="mt-0.5 truncate text-lg font-extrabold tracking-tight sm:mt-1 sm:text-2xl lg:text-3xl">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span className="hidden size-10 place-items-center rounded-full bg-kez-blue-light sm:grid">🔔</span>
            <span className="grid size-9 place-items-center rounded-full bg-kez-yellow font-bold text-kez-dark sm:size-10">{avatarLetter}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

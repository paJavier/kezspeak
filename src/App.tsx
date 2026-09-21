import { FormEvent, createContext, useContext, useEffect, useState } from "react"
import { supabase, type Profile } from "./lib/supabase"

type View = "landing" | "login" | "signup" | "student" | "tutor" | "admin"
type AuthState = "loading" | "authenticated" | "unauthenticated"

type AuthContextType = {
  profile: Profile | null
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextType>({
  profile: null,
  signOut: async () => {},
})
const useAuth = () => useContext(AuthContext)

type IconProps = { className?: string size?: number }

const Mic = ({ className = "", size = 24 }: IconProps) => (
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
const Arrow = ({ className = "", size = 18 }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const Check = ({ className = "", size = 18 }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m5 12 4.2 4L19 6.5" />
  </svg>
)
const Play = ({ className = "", size = 18 }: IconProps) => (
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
const Sparkle = ({ className = "", size = 18 }: IconProps) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 1.8c.7 5.8 3 8.7 8.8 9.5-5.8.7-8.7 3-9.5 8.8-.7-5.8-3-8.7-8.8-9.5 5.8-.7 8.7-3 9.5-8.8Z" />
  </svg>
)

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-kez-blue-light">
      <div className="grid size-16 place-items-center rounded-2xl bg-kez-blue text-kez-yellow shadow-xl shadow-blue-900/20">
        <Mic size={30} />
      </div>
      <div className="text-center">
        <p className="text-lg font-extrabold tracking-tight text-kez-dark">
          Loading your speaking journey<span className="animate-pulse">...</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">Just a moment</p>
      </div>
      <span className="size-6 animate-spin rounded-full border-2 border-kez-blue/30 border-t-kez-blue" />
    </div>
  )
}

function NoProfileScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-kez-blue-light px-6 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-red-100 text-red-500">
        <span className="text-2xl">⚠️</span>
      </div>
      <div>
        <p className="text-lg font-extrabold text-kez-dark">
          Profile not found
        </p>
        <p className="mt-2 max-w-sm text-sm text-slate-600">
          Your KezSpeak profile could not be found. Please contact an
          administrator.
        </p>
      </div>
      <button
        onClick={onSignOut}
        className="rounded-xl bg-kez-blue px-6 py-3 text-sm font-bold text-white"
      >
        Sign Out
      </button>
    </div>
  )
}

function Brand({
  onClick,
}: {
  dark?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={
        onClick ?? (() => window.scrollTo({ top: 0, behavior: "smooth" }))
      }
      className="flex cursor-pointer items-center"
    >
      <img
        src="/images/logo.png"
        alt="KezSpeak"
        className="h-16 w-20 object-contain"
      />
    </div>
  )
}

function LoginLogo() {
  return (
    <img
      src="/images/logo.png"
      alt="KezSpeak"
      className="h-20 w-36 object-contain"
    />
  )
}

function Wave({ light = false }: { light?: boolean }) {
  const levels = [
    23, 48, 70, 40, 86, 58, 35, 74, 95, 52, 30, 67, 47, 90, 62, 36, 72, 44,
  ]
  return (
    <div className="flex h-12 items-center gap-1.5">
      {levels.map((height, i) => (
        <i
          key={i}
          className={`block w-1 rounded-full ${
            light ? "bg-white/70" : "bg-kez-blue"
          }`}
          style={{ height: `${height}%`, opacity: i === 8 ? 1 : undefined }}
        />
      ))}
    </div>
  )
}

function HeroVideo() {
  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[530px] overflow-hidden rounded-[32px] bg-kez-blue shadow-[0_30px_60px_rgba(30,64,175,.25)]"
    >
      <video
        className="size-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/videos/WEBSITE VIDEO LOOP.mp4" type="video/mp4" />
        Your browser does not support the KezSpeak hero video.
      </video>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-kez-blue/15 via-transparent to-white/10" />
    </div>
  )
}

const journeys = [
  ["01", "🎤", "Assess", "Discover your current speaking proficiency."],
  ["02", "🗣️", "Practice", "Complete engaging English speaking activities."],
  ["03", "🌱", "Improve", "Build fluency, vocabulary, and confidence."],
  ["04", "🎯", "Reassess", "Complete your post-assessment."],
  ["05", "📈", "See Your Growth", "Compare results and measure improvement."],
]

const features = [
  [
    "01",
    "Speaking Assessment",
    "A clear, friendly way to understand where your speaking is today.",
    "mic",
  ],
  [
    "02",
    "Speaking Activities",
    "Conversations, storytelling, role-play, pronunciation, and more.",
    "chat",
  ],
  [
    "03",
    "Tutor Feedback",
    "Specific encouragement and guidance from a tutor who knows you.",
    "notes",
  ],
  [
    "04",
    "Pre & Post Comparison",
    "Watch your confidence grow with evidence you can hear and see.",
    "chart",
  ],
]

function FeatureGlyph({ type }: { type: string }) {
  if (type === "mic") return <Mic size={28} />
  if (type === "chat") return <span className="text-3xl leading-none">💬</span>
  if (type === "notes") return <span className="text-3xl leading-none">✦</span>
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M5 24V16M15 24V7M25 24v-12" />
    </svg>
  )
}

function Landing({
  onLogin,
  onSignup,
}: {
  onLogin: () => void
  onSignup: () => void
}) {
  return (
    <div className="overflow-hidden bg-white text-kez-dark">
      <header className="mx-auto flex h-24 max-w-[1240px] items-center justify-between px-6">
        <Brand />
        <nav className="hidden items-center gap-9 text-sm font-semibold text-slate-600 lg:flex">
          <a className="text-kez-blue" href="#home">
            Home
          </a>
          <a href="#about">About</a>
          <a href="#journey">How It Works</a>
          <a href="#features">Features</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="hidden px-4 py-2.5 text-sm font-bold text-kez-blue sm:block"
          >
            Log In
          </button>
          <button
            onClick={onSignup}
            className="rounded-xl bg-kez-blue px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-800"
          >
            Get Started
          </button>
        </div>
      </header>

      <main id="home">
        <section className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-6 pb-24 pt-12 lg:grid-cols-[.95fr_1.05fr] lg:pb-28 lg:pt-20">
          <div className="relative z-10 max-w-[600px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-kez-yellow-light px-4 py-2 text-xs font-bold text-amber-800">
              <span className="grid size-5 place-items-center rounded-full bg-kez-yellow text-kez-dark">
                <Sparkle size={11} />
              </span>{" "}
              Speak with confidence, your way
            </div>
            <h1 className="text-balance text-5xl font-extrabold leading-[1.08] tracking-[-.055em] text-kez-dark sm:text-6xl lg:text-7xl">
              English Made Fun.
              <br />
              <span className="text-kez-blue">Confidence Made Easy.</span>
            </h1>
            <p className="mt-6 max-w-[510px] text-lg leading-8 text-slate-600">
              Discover your English speaking proficiency, practice with purpose,
              and see how much you’ve improved.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#journey"
                className="group flex items-center gap-2 rounded-xl bg-kez-blue px-5 py-4 text-sm font-bold text-white shadow-xl shadow-blue-900/15 transition hover:-translate-y-0.5"
              >
                Start Your Assessment{" "}
                <Arrow
                  className="transition group-hover:translate-x-0.5"
                  size={17}
                />
              </a>
              <a
                href="#features"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-kez-blue transition hover:border-kez-blue hover:bg-kez-blue-light"
              >
                <span className="grid size-5 place-items-center rounded-full bg-kez-blue text-white">
                  <Play size={10} />
                </span>
                Explore KezSpeak
              </a>
            </div>
            <div className="mt-12 flex items-center gap-4">
              <div className="flex -space-x-3">
                <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-pink-200 text-xs">
                  😊
                </span>
                <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-sky-200 text-xs">
                  👋
                </span>
                <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-orange-200 text-xs">
                  🧑🏽
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500">
                <b className="text-kez-dark">2,000+ learners</b> are finding
                their voice
              </p>
            </div>
          </div>
          <HeroVideo />
        </section>

        <section id="journey" className="bg-kez-blue-light py-24">
          <div className="mx-auto max-w-[1240px] px-6">
            <p className="mb-3 text-sm font-extrabold uppercase tracking-[.18em] text-kez-blue">
              One clear path forward
            </p>
            <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
              <h2 className="text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">
                Your Speaking Journey
              </h2>
              <p className="max-w-sm text-slate-600">
                A guided cycle designed to make every step feel possible.
              </p>
            </div>
            <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="absolute left-[9%] right-[9%] top-11 hidden h-px bg-blue-200 lg:block" />
              {journeys.map(([number, emoji, title, description], index) => (
                <article
                  key={title}
                  className="relative rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-kez-blue">
                      {number}
                    </span>
                    <span className="grid size-11 place-items-center rounded-xl bg-kez-yellow-light text-xl">
                      {emoji}
                    </span>
                  </div>
                  <h3 className="font-bold text-kez-dark">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {description}
                  </p>
                  {index < 4 && (
                    <span className="absolute -right-3 top-9 z-10 hidden grid size-6 place-items-center rounded-full bg-kez-blue text-white lg:grid">
                      <Arrow size={13} />
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1240px] px-6 py-28">
          <div className="grid gap-10 lg:grid-cols-[.74fr_1.26fr]">
            <div>
              <p className="mb-3 text-sm font-extrabold uppercase tracking-[.18em] text-kez-blue">
                Built for speaking
              </p>
              <h2 className="text-4xl font-extrabold leading-tight tracking-[-.045em] sm:text-5xl">
                Everything You Need to Find Your Voice
              </h2>
              <p className="mt-6 max-w-sm leading-7 text-slate-600">
                KezSpeak keeps the focus where it belongs: on speaking more,
                understanding your growth, and feeling ready for the next
                conversation.
              </p>
              <a
                href="#journey"
                className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-kez-blue"
              >
                See how it works <Arrow size={16} />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(([number, title, copy, glyph], i) => (
                <article
                  key={title}
                  className={`min-h-60 rounded-3xl p-7 ${
                    i === 0
                      ? "bg-kez-blue text-white"
                      : i === 1
                        ? "bg-kez-yellow-light"
                        : i === 2
                          ? "bg-slate-50"
                          : "bg-kez-blue-light"
                  }`}
                >
                  <div
                    className={`mb-10 flex items-start justify-between ${
                      i === 0 ? "text-kez-yellow" : "text-kez-blue"
                    }`}
                  >
                    <span className="grid size-12 place-items-center rounded-2xl bg-white/80 shadow-sm">
                      <FeatureGlyph type={glyph} />
                    </span>
                    <span className="font-mono text-xs font-bold opacity-60">
                      {number}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold tracking-tight">
                    {title}
                  </h3>
                  <p
                    className={`mt-3 text-sm leading-6 ${
                      i === 0 ? "text-white/70" : "text-slate-600"
                    }`}
                  >
                    {copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-[1240px] px-6 pb-28">
          <div className="relative overflow-hidden rounded-[32px] bg-kez-blue px-8 py-14 text-white sm:px-16 sm:py-16">
            <div className="absolute -right-12 -top-20 size-64 rounded-full border-[30px] border-white/10" />
            <div className="absolute bottom-5 right-[20%] size-8 rounded-full bg-kez-yellow" />
            <div className="relative max-w-[620px]">
              <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-kez-yellow text-kez-dark">
                <Mic size={25} />
              </span>
              <h2 className="text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">
                Ready to find your voice?{" "}
                <span className="inline-block">🎤</span>
              </h2>
              <p className="mt-5 max-w-[500px] text-lg leading-8 text-blue-100">
                Start your English speaking journey and discover what you can
                achieve.
              </p>
              <a
                href="#journey"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-kez-yellow px-5 py-4 text-sm font-bold text-kez-dark shadow-lg transition hover:-translate-y-0.5"
              >
                Start Your Assessment <Arrow size={17} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer id="contact" className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-6 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Brand />
            <p className="mt-4 text-sm text-slate-500">
              English Made Fun. Confidence Made Easy.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-slate-500">
            <a href="#about">About</a>
            <a href="#journey">How It Works</a>
            <a href="#features">Features</a>
            <a href="#contact">Contact</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms</a>
          </div>
          <div className="flex gap-3">
            <a
              href="#"
              className="grid size-9 place-items-center rounded-full bg-white font-bold text-kez-blue shadow-sm"
            >
              in
            </a>
            <a
              href="#"
              className="grid size-9 place-items-center rounded-full bg-white font-bold text-kez-blue shadow-sm"
            >
              f
            </a>
            <a
              href="#"
              className="grid size-9 place-items-center rounded-full bg-white font-bold text-kez-blue shadow-sm"
            >
              ◎
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Login({
  onBack,
  onSignup,
}: {
  onBack: () => void
  onSignup: () => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setErrorMsg("")

    if (!email.trim()) {
      setErrorMsg("Please enter your email address.")
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.")
      return
    }
    if (!password.trim()) {
      setErrorMsg("Please enter your password.")
      return
    }

    setLoading(true)
    const trimmedEmail = email.trim()
    console.log("[KezSpeak] Attempting login for:", trimmedEmail)

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (error) {
      console.log("[KezSpeak] Login failed — Supabase error:", error.message)
      setLoading(false)
      const msg = error.message.toLowerCase()
      if (msg.includes("confirm") || msg.includes("not confirmed") || msg.includes("verification")) {
        setErrorMsg("Please confirm your email address before logging in. Check your inbox for a confirmation link.")
      } else if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("user not found") || msg.includes("wrong")) {
        setErrorMsg("Incorrect email or password.")
      } else if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
        setErrorMsg("We couldn't connect to KezSpeak. Please try again.")
      } else if (msg.includes("too many") || msg.includes("rate")) {
        setErrorMsg("Too many attempts. Please wait a moment and try again.")
      } else {
        setErrorMsg(`Login error: ${error.message}`)
      }
      return
    }

    console.log("[KezSpeak] Login succeeded — session listener will handle redirect")
  }
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_.91fr]">
      <section className="relative flex min-h-[540px] flex-col overflow-hidden bg-kez-blue px-6 py-7 text-white sm:px-12 sm:py-10 lg:min-h-screen lg:px-14 lg:py-12">
        <button onClick={onBack} className="relative z-10 self-start">
          <LoginLogo />
        </button>
        <div className="relative z-10 mx-auto my-auto w-full max-w-[590px]">
          <div className="relative mx-auto h-[245px] w-full max-w-[430px] sm:h-[310px] lg:h-[350px] lg:max-w-[510px]">
            <div className="absolute inset-x-6 bottom-0 top-6 rounded-[42px] bg-blue-800/60" />
            <div className="absolute inset-x-[12%] bottom-2 top-9 overflow-hidden rounded-[36px] bg-white p-3 shadow-2xl shadow-blue-950/25 sm:p-5">
              <img
                src="/images/mascot.png"
                alt="KezSpeak mascot"
                className="size-full object-contain"
              />
            </div>
            <div className="absolute left-0 top-0 rounded-2xl bg-white p-3 text-kez-blue shadow-xl sm:left-4 sm:p-4">
              <div className="flex items-center gap-2">
                <Mic size={18} />
                <Wave />
              </div>
              <p className="mt-2 text-xs font-bold">You’re sounding great!</p>
            </div>
            <div className="absolute right-0 top-20 grid size-14 place-items-center rounded-2xl bg-kez-yellow text-kez-dark shadow-xl sm:right-2 sm:top-24 sm:size-20 sm:rounded-3xl">
              <Sparkle size={28} />
            </div>
            <div className="absolute -bottom-1 left-[7%] grid size-16 place-items-center rounded-full border-[6px] border-white bg-kez-blue text-kez-yellow shadow-xl sm:size-20 sm:border-[7px]">
              <Mic size={28} />
            </div>
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-.05em] sm:text-5xl">
            Ready to find
            <br />
            your voice?
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
            Continue your English speaking journey with KezSpeak.
          </p>
        </div>
        <p className="relative z-10 mt-8 text-sm text-blue-200 lg:mt-0">
          © 2026 KezSpeak · English Made Fun.
        </p>
        <div className="absolute -bottom-32 -left-28 size-80 rounded-full border-[35px] border-white/10" />
      </section>
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-12 lg:px-[12%]">
        <div className="flex items-center justify-between lg:hidden">
          <button onClick={onBack}>
            <LoginLogo />
          </button>
          <button onClick={onBack} className="text-sm font-bold text-kez-blue">
            Back to home
          </button>
        </div>
        <button
          onClick={onBack}
          className="ml-auto hidden text-sm font-bold text-kez-blue lg:block"
        >
          ← Back to home
        </button>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 items-center">
          <div className="w-full">
            <div className="mb-8">
              <h2 className="text-4xl font-extrabold tracking-[-.045em] text-kez-dark">
                Welcome back! <span>👋</span>
              </h2>
              <p className="mt-3 text-slate-500">
                Log in to continue your speaking journey.
              </p>
            </div>
            <form onSubmit={submit} noValidate>
                <label className="block text-sm font-bold text-kez-dark">
                  Email Address
                  <input
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setErrorMsg("")
                    }}
                    placeholder="Enter your email address"
                    autoComplete="email"
                    className={`mt-2 h-13 w-full rounded-xl border bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-kez-blue focus:ring-4 focus:ring-blue-100 ${
                      errorMsg ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                </label>
                <label className="mt-5 block text-sm font-bold text-kez-dark">
                  Password
                  <input
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrorMsg("")
                    }}
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={`mt-2 h-13 w-full rounded-xl border bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-kez-blue focus:ring-4 focus:ring-blue-100 ${
                      errorMsg ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                </label>
                {errorMsg && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    {errorMsg}
                  </p>
                )}
                <div className="mt-5 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-kez-blue focus:ring-kez-blue"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="text-sm font-bold text-kez-blue"
                  >
                    Forgot password?
                  </button>
                </div>
                <button
                  disabled={loading}
                  className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-kez-blue text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 disabled:opacity-75"
                >
                  {loading && (
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {loading ? "Logging in..." : "Log In"}
                </button>
                <p className="mt-7 text-center text-sm text-slate-500">
                  Don’t have an account?{" "}
                  <button
                    type="button"
                    onClick={onSignup}
                    className="font-bold text-kez-blue"
                  >
                    Get started
                  </button>
                </p>
              </form>
          </div>
        </div>
      </section>
    </div>
  )
}

function Signup({
  onBack,
  onLogin,
}: {
  onBack: () => void
  onLogin: () => void
}) {
  const [created, setCreated] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setErrorMsg("")

    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.")
      return
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.")
      return
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return
    }

    setLoading(true)
    console.log("[KezSpeak] Signing up:", email)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    setLoading(false)

    if (error) {
      console.log("[KezSpeak] Signup failed:", error.message)
      setErrorMsg(
        error.message.includes("already registered")
          ? "An account with this email already exists."
          : "We couldn't create your account. Please try again.",
      )
      return
    }

    console.log("[KezSpeak] Signup succeeded")
    setCreated(true)
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[.92fr_1fr]">
      <section className="relative hidden overflow-hidden bg-kez-blue-light p-14 lg:flex lg:flex-col">
        <Brand onClick={onBack} />
        <div className="my-auto max-w-md">
          <span className="grid size-16 place-items-center rounded-3xl bg-kez-yellow text-kez-dark shadow-lg">
            <Mic size={30} />
          </span>
          <p className="mt-9 text-sm font-extrabold uppercase tracking-[.18em] text-kez-blue">
            Start today
          </p>
          <h1 className="mt-3 text-5xl font-extrabold leading-tight tracking-[-.05em] text-kez-dark">
            Every voice deserves to be heard.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Create your KezSpeak account and begin a speaking journey built
            around your growth.
          </p>
          <div className="mt-10 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-kez-dark">Your first step</span>
              <span className="rounded-full bg-kez-yellow-light px-3 py-1 text-xs font-bold text-amber-800">
                5–10 min
              </span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-blue-100">
              <div className="h-full w-1/5 rounded-full bg-kez-blue" />
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Take a short, friendly speaking assessment.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          English Made Fun. Confidence Made Easy.
        </p>
      </section>
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-12 lg:px-[15%]">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <Brand onClick={onBack} />
          </div>
          <button onClick={onBack} className="text-sm font-bold text-kez-blue">
            ← Back to home
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 items-center">
          <div className="w-full">
            {created ? (
              <div className="rounded-3xl border border-green-200 bg-green-50 px-7 py-10 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-green-500 text-white">
                  <Check size={31} />
                </div>
                <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-kez-dark">
                  Account created!
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Check your email to confirm your account, then log in to
                  start your speaking journey.
                </p>
                <button
                  onClick={onLogin}
                  className="mt-7 h-13 w-full rounded-xl bg-kez-blue text-sm font-bold text-white shadow-lg shadow-blue-900/15"
                >
                  Go to Log In
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-4xl font-extrabold tracking-[-.045em] text-kez-dark">
                    Create your account <span>✨</span>
                  </h1>
                  <p className="mt-3 text-slate-500">
                    A few details and you’ll be ready to speak.
                  </p>
                </div>
                <form onSubmit={submit} noValidate>
                  <label className="block text-sm font-bold text-kez-dark">
                    Full Name
                    <input
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value)
                        setErrorMsg("")
                      }}
                      placeholder="Enter your full name"
                      autoComplete="name"
                      className="mt-2 h-13 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-kez-blue focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="mt-5 block text-sm font-bold text-kez-dark">
                    Email Address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setErrorMsg("")
                      }}
                      placeholder="Enter your email address"
                      autoComplete="email"
                      className="mt-2 h-13 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-kez-blue focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="mt-5 block text-sm font-bold text-kez-dark">
                    Create Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setErrorMsg("")
                      }}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="mt-2 h-13 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-kez-blue focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="mt-5 block text-sm font-bold text-kez-dark">
                    Confirm Password
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setErrorMsg("")
                      }}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      className="mt-2 h-13 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-kez-blue focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  {errorMsg && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      {errorMsg}
                    </p>
                  )}
                  <label className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
                    <input
                      required
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-slate-300 text-kez-blue focus:ring-kez-blue"
                    />
                    I agree to the Terms and Privacy Policy.
                  </label>
                  <button
                    disabled={loading}
                    className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-kez-blue text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 disabled:opacity-75"
                  >
                    {loading && (
                      <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    )}
                    {loading ? "Creating account..." : "Create Account"}
                  </button>
                </form>
                <p className="mt-7 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <button onClick={onLogin} className="font-bold text-kez-blue">
                    Log in
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

const studentNav = [
  ["dashboard", "⌂", "Dashboard"],
  ["assessment", "🎤", "My Assessment"],
  ["activities", "🗣", "Speaking Activities"],
  ["feedback", "💬", "Feedback"],
  ["progress", "↗", "My Progress"],
  ["results", "▦", "Results"],
  ["profile", "◉", "Profile"],
]
const skillScores = [
  ["Pronunciation", 70, "bg-sky-400"],
  ["Fluency", 65, "bg-amber-400"],
  ["Grammar", 74, "bg-indigo-400"],
  ["Vocabulary", 78, "bg-emerald-400"],
  ["Confidence", 68, "bg-rose-400"],
]

function StudentApp({ onExit }: { onExit: () => void }) {
  const { profile, signOut } = useAuth()
  const firstName = profile?.full_name?.split(" ")[0] ?? "there"
  const avatarLetter = profile?.full_name?.[0]?.toUpperCase() ?? "?"
  const [page, setPage] = useState("dashboard")
  const [recording, setRecording] = useState(false)
  const [done, setDone] = useState(false)
  const [filter, setFilter] = useState("All")
  const titles: Record<string, string> = {
    dashboard: `Good morning, ${firstName}! 👋`,
    assessment: "My Speaking Assessment",
    activities: "Speaking Activities",
    activity: "Describe Your Weekend",
    feedback: "Your Feedback",
    progress: "My Speaking Progress",
    results: "Your Pre-Assessment Results",
    profile: "Your Profile",
  }
  const ScoreBars = () => (
    <div className="space-y-4">
      {skillScores.map(([name, score, color]) => (
        <div key={name}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-semibold text-slate-600">{name}</span>
            <b>{score}%</b>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
  return (
    <div className="flex min-h-screen bg-[#f8fbff] text-kez-dark">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-kez-dark px-3 py-5 text-white lg:flex">
        <div className="px-3">
          <Brand dark />
        </div>
        <p className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">
          My space
        </p>
        <nav className="mt-3 space-y-1">
          {studentNav.map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${
                page === id || (id === "activities" && page === "activity")
                  ? "bg-kez-blue text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-lg">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <button className="flex w-full gap-3 rounded-xl px-3 py-3 text-sm text-white/60">
            ⚙ Settings
          </button>
          <button
            onClick={signOut}
            className="flex w-full gap-3 rounded-xl px-3 py-3 text-sm text-white/60"
          >
            ↪ Log Out
          </button>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/8 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-kez-yellow font-bold text-kez-dark">
              {avatarLetter}
            </span>
            <div>
              <p className="text-sm font-bold">{profile?.full_name ?? "Student"}</p>
              <p className="text-[11px] text-white/45">Developing Speaker</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5 sm:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-kez-blue">
              KezSpeak Student
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {titles[page]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-kez-blue-light">
              🔔
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-kez-yellow font-bold">
              {avatarLetter}
            </span>
          </div>
        </header>
        <div className="mx-auto max-w-[1240px] p-6 sm:p-10">
          {page === "dashboard" && (
            <>
              <p className="text-slate-500">
                Let’s see how your English is growing.
              </p>
              <section className="mt-8 rounded-3xl bg-kez-blue p-7 text-white">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold tracking-wider text-kez-yellow">
                      YOUR SPEAKING JOURNEY
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold">
                      You’re building momentum.
                    </h2>
                  </div>
                  <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
                    Stage 2 of 4
                  </span>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-4">
                  {[
                    ["✓", "Pre-Assessment", "Completed"],
                    ["02", "Practice", "In progress"],
                    ["03", "Post-Assessment", "Up next"],
                    ["04", "Improvement", "Unlocks soon"],
                  ].map(([n, label, status], i) => (
                    <div
                      key={label}
                      className={`rounded-2xl p-4 ${
                        i === 1 ? "bg-kez-yellow text-kez-dark" : "bg-white/10"
                      }`}
                    >
                      <b className="font-mono text-xs">{n}</b>
                      <p className="mt-4 font-bold">{label}</p>
                      <p className="mt-1 text-xs opacity-70">{status}</p>
                    </div>
                  ))}
                </div>
              </section>
              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <section className="rounded-3xl bg-white p-7 shadow-sm">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400">
                        YOUR SPEAKING ASSESSMENT
                      </p>
                      <h2 className="mt-2 text-xl font-extrabold">
                        Pre-Assessment
                      </h2>
                      <p className="mt-3 text-sm font-bold text-green-600">
                        ✓ Completed
                      </p>
                    </div>
                    <p className="text-3xl font-extrabold text-kez-blue">
                      72<span className="text-sm text-slate-400"> / 100</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setPage("results")}
                    className="mt-7 text-sm font-bold text-kez-blue"
                  >
                    View Results →
                  </button>
                </section>
                <section className="rounded-3xl bg-kez-yellow-light p-7">
                  <p className="text-xs font-bold text-amber-700">
                    TODAY’S SPEAKING PRACTICE
                  </p>
                  <h2 className="mt-2 text-xl font-extrabold">
                    Describe Your Favorite Place
                  </h2>
                  <p className="mt-3 text-sm text-amber-900">
                    Fluency + Vocabulary · 5 minutes
                  </p>
                  <button
                    onClick={() => setPage("activity")}
                    className="mt-6 rounded-xl bg-kez-dark px-4 py-3 text-sm font-bold text-white"
                  >
                    🎤 Start Practice
                  </button>
                </section>
              </div>
              <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
                <section className="rounded-3xl bg-white p-7 shadow-sm">
                  <div className="flex justify-between">
                    <h2 className="text-lg font-extrabold">
                      Progress Overview
                    </h2>
                    <b className="text-3xl text-kez-blue">72%</b>
                  </div>
                  <p className="mb-6 text-sm text-slate-500">
                    Overall speaking proficiency
                  </p>
                  <ScoreBars />
                </section>
                <section className="rounded-3xl bg-white p-7 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-pink-100">
                      👩🏽
                    </span>
                    <div>
                      <p className="font-extrabold">Feedback from Maria</p>
                      <p className="text-xs text-slate-400">
                        Your speaking tutor
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-slate-600">
                    “Your ideas were clear and you used a good range of
                    vocabulary. Keep practicing sentence pacing.”
                  </p>
                  <button
                    onClick={() => setPage("feedback")}
                    className="mt-5 text-sm font-bold text-kez-blue"
                  >
                    View Feedback →
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "assessment" && (
            <section className="max-w-4xl">
              <p className="text-slate-500">
                Your assessment path makes progress easy to see.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  ["✓", "Pre-Assessment", "Completed"],
                  ["02", "Speaking Activities", "In Progress"],
                  ["🔒", "Post-Assessment", "Not Available Yet"],
                  ["🔒", "Final Comparison", "Locked"],
                ].map(([n, name, status], i) => (
                  <div
                    key={name}
                    className="flex items-center gap-5 rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <span
                      className={`grid size-11 place-items-center rounded-full font-bold ${
                        i === 0
                          ? "bg-green-500 text-white"
                          : i === 1
                            ? "bg-kez-blue text-white"
                            : "bg-slate-100"
                      }`}
                    >
                      {n}
                    </span>
                    <div className="flex-1">
                      <b>{name}</b>
                      <p className="text-sm text-slate-500">{status}</p>
                    </div>
                    {i === 1 && (
                      <button
                        onClick={() => setPage("activities")}
                        className="rounded-lg bg-kez-blue-light px-3 py-2 text-xs font-bold text-kez-blue"
                      >
                        Continue
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-7 rounded-2xl bg-kez-yellow-light p-5 text-sm text-amber-900">
                💡 Complete your speaking activities before taking the
                post-assessment.
              </p>
            </section>
          )}
          {page === "activities" && (
            <>
              <p className="text-slate-500">
                Practice your English through meaningful conversations and
                activities.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {[
                  "All",
                  "Conversation",
                  "Pronunciation",
                  "Fluency",
                  "Vocabulary",
                  "Grammar",
                  "Storytelling",
                  "Role Play",
                ].map((x) => (
                  <button
                    key={x}
                    onClick={() => setFilter(x)}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      filter === x
                        ? "bg-kez-blue text-white"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Describe Your Weekend", "Fluency", "Intermediate", "5 min"],
                  [
                    "Coffee Shop Conversation",
                    "Conversation",
                    "Beginner",
                    "4 min",
                  ],
                  ["The TH Sound", "Pronunciation", "Intermediate", "6 min"],
                  ["A Memorable Day", "Storytelling", "Advanced", "8 min"],
                ].map(([name, skill, difficulty, time], i) => (
                  <article
                    key={name}
                    className="rounded-3xl bg-white p-5 shadow-sm"
                  >
                    <span className="grid size-12 place-items-center rounded-2xl bg-kez-blue-light text-2xl">
                      {["🎙️", "💭", "👄", "📚"][i]}
                    </span>
                    <h2 className="mt-7 font-extrabold">{name}</h2>
                    <p className="mt-4 text-xs leading-6 text-slate-500">
                      Skill{" "}
                      <b className="float-right text-slate-700">{skill}</b>
                      <br />
                      Difficulty{" "}
                      <b className="float-right text-slate-700">{difficulty}</b>
                      <br />
                      Duration{" "}
                      <b className="float-right text-slate-700">{time}</b>
                    </p>
                    <button
                      onClick={() => setPage("activity")}
                      className="mt-6 w-full rounded-xl bg-kez-blue-light py-3 text-sm font-bold text-kez-blue"
                    >
                      Practice
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {page === "activity" && (
            <section className="mx-auto max-w-3xl text-center">
              <p className="text-lg leading-8 text-slate-600">
                Speak for 60 seconds about what you did last weekend. Try to
                explain what you enjoyed and why.
              </p>
              <div className="mt-8 rounded-[32px] bg-white p-8 shadow-sm">
                <span className="rounded-full bg-kez-yellow-light px-4 py-2 text-sm font-bold text-amber-800">
                  60 seconds
                </span>
                <div
                  className={`mx-auto mt-8 grid size-40 place-items-center rounded-full ${
                    recording
                      ? "bg-red-50 text-red-500 ring-8 ring-red-100"
                      : "bg-kez-blue text-kez-yellow"
                  }`}
                >
                  <Mic size={58} />
                </div>
                {recording ? (
                  <>
                    <p className="mt-6 text-3xl font-extrabold">00:42</p>
                    <div className="mx-auto mt-5 w-fit">
                      <Wave />
                    </div>
                    <div className="mt-7 flex justify-center gap-3">
                      <button
                        onClick={() => setRecording(false)}
                        className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold"
                      >
                        Pause
                      </button>
                      <button
                        onClick={() => {
                          setRecording(false)
                          setDone(true)
                        }}
                        className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white"
                      >
                        Stop
                      </button>
                    </div>
                  </>
                ) : done ? (
                  <>
                    <button className="mt-7 rounded-xl bg-kez-blue-light px-5 py-3 text-sm font-bold text-kez-blue">
                      ▶ Play Recording
                    </button>
                    <button
                      onClick={() => setPage("activities")}
                      className="mt-4 w-full rounded-xl bg-kez-blue py-4 text-sm font-bold text-white"
                    >
                      Submit
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setRecording(true)}
                    className="mt-7 rounded-xl bg-kez-blue px-6 py-4 text-sm font-bold text-white"
                  >
                    🎤 Start Recording
                  </button>
                )}
                <p className="mt-7 text-sm font-semibold text-slate-500">
                  Speak naturally. Take your time. You’ve got this! 🌟
                </p>
              </div>
            </section>
          )}
          {page === "feedback" && (
            <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
              <div className="rounded-3xl bg-kez-blue p-7 text-white">
                <p className="text-sm font-bold text-kez-yellow">
                  PRE-ASSESSMENT
                </p>
                <p className="mt-7 text-6xl font-extrabold">
                  72<span className="text-xl text-blue-200"> / 100</span>
                </p>
                <p className="mt-2 text-blue-100">Maria Santos · Tutor</p>
                <div className="mt-8 rounded-2xl bg-white/10 p-4">
                  <p className="text-sm font-bold">Listen to Recording</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button className="grid size-9 place-items-center rounded-full bg-kez-yellow text-kez-dark">
                      <Play size={14} />
                    </button>
                    <Wave light />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  [
                    "Pronunciation",
                    "70",
                    "Your pronunciation is understandable. Practice difficult sounds more consistently.",
                  ],
                  [
                    "Fluency",
                    "65",
                    "Try reducing long pauses and maintain a natural speaking rhythm.",
                  ],
                  ["Vocabulary", "78", "You use a good variety of words."],
                  ["Confidence", "68", "Keep practicing spontaneous speaking."],
                ].map(([name, score, text]) => (
                  <article
                    key={name}
                    className="rounded-3xl bg-white p-6 shadow-sm"
                  >
                    <b className="text-2xl text-kez-blue">
                      {score}
                      <small className="text-xs text-slate-400"> / 100</small>
                    </b>
                    <h2 className="mt-3 font-extrabold">{name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      “{text}”
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
          {(page === "progress" || page === "results") && (
            <section>
              <div className="rounded-3xl bg-white p-7 shadow-sm">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-bold text-kez-blue">
                      {page === "results"
                        ? "DEVELOPING SPEAKER"
                        : "SPEAKING PROFICIENCY"}
                    </p>
                    <h2 className="mt-1 text-5xl font-extrabold">
                      72 <span className="text-xl text-slate-400">/ 100</span>
                    </h2>
                  </div>
                  <b className="rounded-full bg-green-50 px-4 py-2 text-sm text-green-700">
                    +6 points this month
                  </b>
                </div>
                <div className="mt-9 flex h-44 items-end gap-4 border-b border-l border-slate-100 px-6">
                  {[54, 58, 62, 65, 68, 72].map((n, i) => (
                    <div
                      key={n}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className="w-full rounded-t-lg bg-kez-blue"
                        style={{
                          height: `${n * 1.7}px`,
                          opacity: 0.5 + i * 0.1,
                        }}
                      />
                      <span className="text-[10px] text-slate-400">
                        W{i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {skillScores.map(([name, score, color]) => (
                  <div
                    key={name}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <p className="text-sm font-bold">{name}</p>
                    <p className="mt-3 text-2xl font-extrabold">
                      {score}
                      <span className="text-xs text-slate-400"> / 100</span>
                    </p>
                    <div
                      className={`mt-4 h-2 rounded-full ${color}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                ))}
              </div>
              {page === "results" && (
                <div className="mt-6 rounded-3xl bg-kez-yellow-light p-7">
                  <h2 className="text-xl font-extrabold">Tutor Feedback</h2>
                  <p className="mt-3 max-w-2xl leading-7 text-amber-950">
                    “Your communication is clear, and you demonstrate good
                    vocabulary. Focus on fluency and pronunciation to make your
                    speaking more natural.”
                  </p>
                  <button
                    onClick={() => setPage("activities")}
                    className="mt-6 rounded-xl bg-kez-dark px-5 py-3 text-sm font-bold text-white"
                  >
                    Start Speaking Activities
                  </button>
                </div>
              )}
            </section>
          )}
          {page === "profile" && (
            <section className="max-w-xl rounded-3xl bg-white p-8 shadow-sm">
              <span className="grid size-20 place-items-center rounded-full bg-kez-yellow text-3xl font-bold">
                J
              </span>
              <h2 className="mt-5 text-2xl font-extrabold">Jamie Carter</h2>
              <p className="text-slate-500">jamie.carter@example.com</p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-kez-blue-light p-4">
                  <p className="text-xs font-bold text-kez-blue">
                    CURRENT LEVEL
                  </p>
                  <p className="mt-2 font-extrabold">Developing Speaker</p>
                </div>
                <div className="rounded-2xl bg-kez-yellow-light p-4">
                  <p className="text-xs font-bold text-amber-800">
                    PRACTICE TIME
                  </p>
                  <p className="mt-2 font-extrabold">2h 45m</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function TutorApp({ onExit }: { onExit: () => void }) {
  const { profile, signOut } = useAuth()
  const firstName = profile?.full_name?.split(" ")[0] ?? "there"
  const avatarLetter = profile?.full_name?.[0]?.toUpperCase() ?? "?"
  const [page, setPage] = useState("dashboard")
  const [reviewed, setReviewed] = useState(false)
  const [tab, setTab] = useState("Pre-Assessment")
  const nav = [
    ["dashboard", "⌂", "Dashboard"],
    ["learners", "👥", "Learners"],
    ["submissions", "🎤", "Assessments"],
    ["activities", "🗣", "Speaking Activities"],
    ["review", "🎧", "Submissions"],
    ["feedback", "💬", "Feedback"],
    ["progress", "↗", "Progress"],
    ["reports", "▦", "Reports"],
    ["profile", "◉", "Profile"],
  ]
  const scores = [
    ["Pronunciation", 70, 84],
    ["Fluency", 65, 82],
    ["Grammar", 74, 86],
    ["Vocabulary", 78, 89],
    ["Confidence", 68, 87],
  ]
  const titles: Record<string, string> = {
    dashboard: `Good morning, ${firstName}! 👋`,
    learners: "My Learners",
    submissions: "Assessment Submissions",
    review: "Speaking Assessment Review",
    feedback: "Feedback",
    progress: "Speaking Progress Comparison",
    reports: "Learner Reports",
    profile: "Maria Santos",
  }
  const pending = [
    ["Jamie Cruz", "Speaking Pre-Assessment", "Today, 10:42 AM"],
    ["Alex Santos", "Speaking Activity", "Today, 9:16 AM"],
    ["Sophia Reyes", "Post-Assessment", "Yesterday, 4:30 PM"],
    ["Daniel Lim", "Speaking Practice", "Yesterday, 2:14 PM"],
  ]
  return (
    <div className="flex min-h-screen bg-[#f8fbff] text-kez-dark">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-kez-dark px-3 py-5 text-white lg:flex">
        <div className="px-3">
          <Brand dark />
        </div>
        <p className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">
          Tutor workspace
        </p>
        <nav className="mt-3 space-y-1">
          {nav.map(([id, icon, label]) => (
            <button
              onClick={() => setPage(id)}
              key={id}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${
                page === id
                  ? "bg-kez-blue text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-lg">{icon}</span>
              {label}
              {id === "review" && (
                <b className="ml-auto rounded-full bg-kez-yellow px-2 py-0.5 text-[10px] text-kez-dark">
                  12
                </b>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4">
          <button className="flex w-full gap-3 px-3 py-3 text-sm text-white/60">
            ⚙ Settings
          </button>
          <button
            onClick={signOut}
            className="flex w-full gap-3 px-3 py-3 text-sm text-white/60"
          >
            ↪ Log Out
          </button>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/8 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-kez-yellow font-bold text-kez-dark">
              {avatarLetter}
            </span>
            <div>
              <p className="text-sm font-bold">{profile?.full_name ?? "Tutor"}</p>
              <p className="text-[11px] text-white/45">Tutor & Assessor</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5 sm:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-kez-blue">
              KezSpeak Tutor
            </p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {titles[page] || "Speaking Activities"}
            </h1>
          </div>
          <div className="flex gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-kez-blue-light">
              🔔
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-kez-yellow font-bold text-kez-dark">
              {avatarLetter}
            </span>
          </div>
        </header>
        <div className="mx-auto max-w-[1280px] p-6 sm:p-10">
          {page === "dashboard" && (
            <>
              <p className="text-slate-500">
                Here’s how your learners are progressing.
              </p>
              <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["👥", "Active Learners", "48", "bg-kez-blue-light"],
                  ["🎧", "Pending Evaluations", "12", "bg-kez-yellow-light"],
                  ["✓", "Assessments Completed", "96", "bg-green-50"],
                  ["↗", "Average Improvement", "+13 points", "bg-pink-50"],
                ].map(([icon, label, value, bg]) => (
                  <div key={label} className={`rounded-3xl p-6 ${bg}`}>
                    <span className="text-2xl">{icon}</span>
                    <p className="mt-6 text-sm font-semibold text-slate-600">
                      {label}
                    </p>
                    <p className="mt-1 text-3xl font-extrabold">{value}</p>
                  </div>
                ))}
              </div>
              <section className="mt-7 rounded-3xl bg-white p-7 shadow-sm">
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold">
                      Needs Your Attention
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Submissions waiting for your expert feedback.
                    </p>
                  </div>
                  <button
                    onClick={() => setPage("review")}
                    className="text-sm font-bold text-kez-blue"
                  >
                    View all →
                  </button>
                </div>
                <div className="mt-6 grid gap-3">
                  {pending.map(([name, type, time]) => (
                    <div
                      key={name}
                      className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-4"
                    >
                      <span className="grid size-10 place-items-center rounded-full bg-blue-100 font-bold text-kez-blue">
                        {name[0]}
                      </span>
                      <div className="min-w-40 flex-1">
                        <p className="font-bold">{name}</p>
                        <p className="text-xs text-slate-500">{type}</p>
                      </div>
                      <p className="text-xs text-slate-500">Submitted {time}</p>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                        Pending review
                      </span>
                      <button
                        onClick={() => setPage("review")}
                        className="rounded-lg bg-kez-blue px-4 py-2 text-xs font-bold text-white"
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {page === "learners" && (
            <>
              <p className="text-slate-500">
                Monitor speaking performance and provide targeted feedback.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <input
                  placeholder="Search learners..."
                  className="h-11 w-72 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-kez-blue"
                />
                {["All", "Improving", "Needs Attention", "Completed"].map(
                  (x, i) => (
                    <button
                      key={x}
                      className={`rounded-xl px-4 text-sm font-bold ${
                        i === 0
                          ? "bg-kez-blue text-white"
                          : "bg-white text-slate-500"
                      }`}
                    >
                      {x}
                    </button>
                  ),
                )}
              </div>
              <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      {[
                        "Learner",
                        "Pre-Assessment",
                        "Post-Assessment",
                        "Improvement",
                        "Last Activity",
                        "Status",
                        "Action",
                      ].map((x) => (
                        <th className="px-6 py-5" key={x}>
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Jamie Cruz", "72", "86", "+14", "Today", "Improving"],
                      ["Alex Santos", "68", "76", "+8", "Today", "Improving"],
                      [
                        "Sophia Reyes",
                        "81",
                        "—",
                        "—",
                        "Yesterday",
                        "Needs review",
                      ],
                      ["Daniel Lim", "62", "74", "+12", "Sep 10", "Improving"],
                    ].map((row) => (
                      <tr key={row[0]} className="border-b border-slate-50">
                        <td className="px-6 py-5 font-bold">{row[0]}</td>
                        {row.slice(1, 5).map((x, index) => (
                          <td key={`${row[0]}-${index}`} className="px-6 py-5 text-slate-600">
                            {x}
                          </td>
                        ))}
                        <td className="px-6 py-5">
                          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                            {row[5]}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <button
                            onClick={() => setPage("progress")}
                            className="font-bold text-kez-blue"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {(page === "submissions" || page === "review") && (
            <>
              {page === "submissions" ? (
                <>
                  <div className="mt-5 flex gap-2">
                    {[
                      "Pre-Assessment",
                      "Post-Assessment",
                      "Speaking Activities",
                    ].map((x) => (
                      <button
                        onClick={() => setTab(x)}
                        key={x}
                        className={`rounded-xl px-4 py-2 text-sm font-bold ${
                          tab === x
                            ? "bg-kez-blue text-white"
                            : "bg-white text-slate-500"
                        }`}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
                    {pending.map(([name, type, time]) => (
                      <div
                        className="flex items-center justify-between border-b border-slate-100 py-4 last:border-0"
                        key={name}
                      >
                        <div>
                          <p className="font-bold">{name}</p>
                          <p className="text-sm text-slate-500">
                            {type} · {time}
                          </p>
                        </div>
                        <div className="flex items-center gap-5">
                          <span className="text-sm font-bold text-amber-600">
                            Pending
                          </span>
                          <button
                            onClick={() => setPage("review")}
                            className="rounded-lg bg-kez-blue px-4 py-2 text-sm font-bold text-white"
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr_.9fr]">
                  <div className="rounded-3xl bg-white p-6 shadow-sm">
                    <span className="grid size-14 place-items-center rounded-full bg-blue-100 text-xl">
                      J
                    </span>
                    <h2 className="mt-4 text-xl font-extrabold">Jamie Cruz</h2>
                    <p className="text-sm text-slate-500">
                      Intermediate Speaker
                    </p>
                    <div className="mt-7 space-y-4 text-sm">
                      <p>
                        Assessment type{" "}
                        <b className="float-right">Post-Assessment</b>
                      </p>
                      <p>
                        Date submitted{" "}
                        <b className="float-right">Sept 12, 2026</b>
                      </p>
                      <p>
                        Previous score{" "}
                        <b className="float-right text-kez-blue">72 / 100</b>
                      </p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="font-extrabold">Jamie’s Recording</h2>
                    <div className="mt-5 rounded-2xl bg-kez-blue p-5 text-white">
                      <div className="flex items-center gap-4">
                        <button className="grid size-11 place-items-center rounded-full bg-kez-yellow text-kez-dark">
                          <Play size={17} />
                        </button>
                        <div className="flex-1">
                          <Wave light />
                          <div className="flex justify-between text-[10px] text-blue-100">
                            <span>0:00</span>
                            <span>1:02</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <h3 className="mt-7 font-extrabold">Transcript</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      “Last weekend, I went to the coast with my family. What I
                      enjoyed most was walking along the beach in the early
                      morning because it was quiet and beautiful…”
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white p-6 shadow-sm">
                    <h2 className="font-extrabold">Speaking Evaluation</h2>
                    <div className="mt-5 space-y-4">
                      {scores.map(([name, pre, post]) => (
                        <div key={name}>
                          <div className="flex justify-between text-sm">
                            <b>{name}</b>
                            <span className="font-bold text-kez-blue">
                              {post} / 100
                            </span>
                          </div>
                          <input
                            type="range"
                            defaultValue={post}
                            className="mt-2 w-full accent-kez-blue"
                          />
                          <input
                            placeholder="Add a comment…"
                            className="mt-2 w-full border-b border-slate-200 pb-2 text-xs outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-2xl bg-kez-yellow-light p-4">
                      <p className="text-xs font-bold text-amber-800">
                        OVERALL SCORE
                      </p>
                      <p className="text-3xl font-extrabold">86 / 100</p>
                    </div>
                    <textarea
                      placeholder="Write constructive feedback for the learner..."
                      className="mt-5 h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-kez-blue"
                    />
                    <div className="mt-4 flex gap-2">
                      <button className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold">
                        Save Draft
                      </button>
                      <button
                        onClick={() => setReviewed(true)}
                        className="rounded-xl bg-kez-blue px-3 py-3 text-xs font-bold text-white"
                      >
                        Submit Evaluation
                      </button>
                    </div>
                    {reviewed && (
                      <p className="mt-4 rounded-xl bg-green-50 p-3 text-xs font-bold text-green-700">
                        ✓ Evaluation submitted! Feedback is now available to the
                        learner.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          {(page === "progress" ||
            page === "reports" ||
            page === "feedback") && (
            <section>
              <div className="rounded-3xl bg-kez-blue p-8 text-white">
                <p className="text-sm font-bold text-kez-yellow">
                  JAMIE CRUZ · SPEAKING PROGRESS
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-7">
                  <div>
                    <p className="text-xs text-blue-200">PRE-ASSESSMENT</p>
                    <p className="text-5xl font-extrabold">72</p>
                  </div>
                  <span className="text-3xl text-kez-yellow">→</span>
                  <div>
                    <p className="text-xs text-blue-200">POST-ASSESSMENT</p>
                    <p className="text-5xl font-extrabold">86</p>
                  </div>
                  <div className="rounded-2xl bg-kez-yellow p-4 text-kez-dark">
                    <p className="text-xs font-bold">IMPROVEMENT</p>
                    <p className="text-2xl font-extrabold">+14 points</p>
                    <p className="text-xs">19.4% improvement</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
                <div className="rounded-3xl bg-white p-7 shadow-sm">
                  <h2 className="font-extrabold">Skill Comparison</h2>
                  <div className="mt-5 space-y-5">
                    {scores.map(([name, pre, post]) => (
                      <div
                        key={name}
                        className="grid grid-cols-[1fr_50px_50px_60px] items-center gap-3 text-sm"
                      >
                        <b>{name}</b>
                        <span className="rounded-lg bg-slate-100 p-2 text-center">
                          {pre}
                        </span>
                        <span className="rounded-lg bg-kez-blue-light p-2 text-center font-bold text-kez-blue">
                          {post}
                        </span>
                        <span className="font-bold text-green-600">
                          +{post - pre}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl bg-kez-yellow-light p-7">
                  <p className="text-sm font-bold text-amber-800">
                    GREATEST IMPROVEMENT
                  </p>
                  <h2 className="mt-4 text-2xl font-extrabold">
                    🎤 Confidence
                  </h2>
                  <p className="mt-1 text-4xl font-extrabold">
                    +19 <span className="text-lg">points</span>
                  </p>
                  <textarea
                    defaultValue="Jamie demonstrates noticeable improvement in fluency, confidence, and pronunciation after completing the speaking activities."
                    className="mt-7 h-28 w-full rounded-xl border border-amber-200 bg-white/70 p-3 text-sm"
                  />
                  <button className="mt-4 rounded-xl bg-kez-dark px-4 py-3 text-sm font-bold text-white">
                    Save Progress Report
                  </button>
                </div>
              </div>
            </section>
          )}
          {page === "profile" && (
            <section className="max-w-xl rounded-3xl bg-white p-8 shadow-sm">
              <span className="text-5xl">👩🏽</span>
              <h2 className="mt-4 text-2xl font-extrabold">Maria Santos</h2>
              <p className="text-slate-500">Tutor & Speaking Assessor</p>
              <div className="mt-7 rounded-2xl bg-kez-blue-light p-5">
                <p className="text-sm font-bold text-kez-blue">
                  48 active learners
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Supporting confidence through focused, kind feedback.
                </p>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [view, setView] = useState<View>("landing")
  const [noProfile, setNoProfile] = useState(false)

  const signOut = async () => {
    console.log("[KezSpeak] Signing out")
    await supabase.auth.signOut()
    setProfile(null)
    setAuthState("unauthenticated")
    setView("landing")
    setNoProfile(false)
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[KezSpeak] Auth event:", event, "user:", session?.user?.id ?? null)
        if (session?.user) {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single()

          console.log("[KezSpeak] Profile lookup — data:", data, "error:", error?.message ?? null)

          if (error && (error.message.includes("relation") || error.message.includes("does not exist"))) {
            console.warn("[KezSpeak] profiles table missing — defaulting to student role")
            const fallbackProfile: Profile = {
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name ?? session.user.email ?? "User",
              email: session.user.email ?? "",
              role: "student",
            }
            setProfile(fallbackProfile)
            setAuthState("authenticated")
            setNoProfile(false)
            setView("student")
            return
          }

          if (!data || error) {
            console.warn("[KezSpeak] No profile found for user:", session.user.id)
            setAuthState("unauthenticated")
            setNoProfile(true)
            return
          }

          const role = data.role as Profile["role"]
          console.log("[KezSpeak] Detected role:", role, "→ redirecting to", role === "tutor" ? "/tutor" : role === "admin" ? "/admin" : "/student")
          setProfile(data as Profile)
          setAuthState("authenticated")
          setNoProfile(false)
          setView(role === "tutor" ? "tutor" : role === "admin" ? "admin" : "student")
        } else {
          setProfile(null)
          setAuthState("unauthenticated")
          setView((prev) =>
            prev === "student" || prev === "tutor" || prev === "admin"
              ? "landing"
              : prev,
          )
        }
      },
    )
    return () => subscription.unsubscribe()
  }, [])

  if (authState === "loading") return <LoadingScreen />

  if (noProfile)
    return <NoProfileScreen onSignOut={signOut} />

  const authValue = { profile, signOut }

  if (authState === "authenticated") {
    if (view === "tutor")
      return (
        <AuthContext.Provider value={authValue}>
          <TutorApp onExit={signOut} />
        </AuthContext.Provider>
      )
    if (view === "admin")
      return (
        <AuthContext.Provider value={authValue}>
          <TutorApp onExit={signOut} />
        </AuthContext.Provider>
      )
    return (
      <AuthContext.Provider value={authValue}>
        <StudentApp onExit={signOut} />
      </AuthContext.Provider>
    )
  }

  if (view === "login") {
    return (
      <Login
        onBack={() => setView("landing")}
        onSignup={() => setView("signup")}
      />
    )
  }
  if (view === "signup") {
    return (
      <Signup
        onBack={() => setView("landing")}
        onLogin={() => setView("login")}
      />
    )
  }
  return (
    <Landing
      onLogin={() => setView("login")}
      onSignup={() => setView("signup")}
    />
  )
}

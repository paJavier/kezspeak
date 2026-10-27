import { type ComponentType, FormEvent, createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { type User as AuthUser } from "@supabase/supabase-js"
import {
  AlertCircle,
  BarChart3,
  ClipboardCheck,
  Eye,
  EyeOff,
  Headphones,
  Link2,
  ListChecks,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  Target,
  TrendingUp,
  User,
  Users,
} from "lucide-react"
import { arrivedFromInvite, arrivedToSetPassword, supabase, type Profile } from "./lib/supabase"
import SetPasswordScreen from "./components/SetPasswordScreen"
import ThemeToggle from "./components/ThemeToggle"
import { Mic, Play, Wave } from "./components/icons"
import AssessmentResults from "./components/student/AssessmentResults"
import RecordActivity from "./components/student/RecordActivity"
import SubmissionReview from "./components/tutor/SubmissionReview"
import DashboardLayout, { type NavItem } from "./components/DashboardLayout"
import AssignmentManagement from "./components/admin/AssignmentManagement"
import TaskManagement from "./components/admin/TaskManagement"
import UserManagement from "./components/admin/UserManagement"
import ProfileCard from "./components/ProfileCard"
import TaskCatalog from "./components/TaskCatalog"
import AssessmentPath from "./components/student/AssessmentPath"
import StudentDashboard from "./components/student/StudentDashboard"
import LearnerOverview from "./components/tutor/LearnerOverview"
import LearnerProgress from "./components/tutor/LearnerProgress"
import TutorDashboard from "./components/tutor/TutorDashboard"
import useSubmissionList from "./hooks/useSubmissionList"
import { greeting, needsReview } from "./lib/progress"

type View = "landing" | "login" | "signup" | "student" | "tutor" | "admin"
type AuthState = "loading" | "authenticated" | "unauthenticated"

type AuthContextType = {
  user: AuthUser | null
  profile: Profile | null
  role: Profile["role"] | null
  loading: boolean
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
})
const useAuth = () => useContext(AuthContext)

type IconProps = { className?: string; size?: number }
type IconComponent = ComponentType<IconProps>

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
        <AlertCircle size={28} aria-hidden="true" />
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

const journeys: [string, IconComponent, string, string][] = [
  ["01", Mic, "Assess", "Discover your current speaking proficiency."],
  ["02", MessageCircle, "Practice", "Complete engaging English speaking activities."],
  ["03", TrendingUp, "Improve", "Build fluency, vocabulary, and confidence."],
  ["04", Target, "Reassess", "Complete your post-assessment."],
  ["05", BarChart3, "See Your Growth", "Compare results and measure improvement."],
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
  if (type === "chat") return <MessageSquare size={28} />
  if (type === "notes") return <ClipboardCheck size={28} />
  return <BarChart3 size={30} />
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
          <ThemeToggle />
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
                <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-pink-200 text-kez-blue"><User size={16} /></span>
                <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-sky-200 text-kez-blue"><Users size={16} /></span>
                <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-orange-200 text-kez-blue"><MessageCircle size={16} /></span>
              </div>
              <p className="text-sm font-medium text-slate-500">
                <b className="text-kez-dark">Kez learners</b> are finding
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
              {journeys.map(([number, JourneyIcon, title, description], index) => (
                <article
                  key={title}
                  className="relative rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-kez-blue">
                      {number}
                    </span>
                    <span className="grid size-11 place-items-center rounded-xl bg-kez-yellow-light text-kez-blue">
                      <JourneyIcon size={21} />
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
                  className={`min-h-60 rounded-3xl p-7 ${i === 0
                    ? "bg-kez-blue text-white"
                    : i === 1
                      ? "bg-kez-yellow-light"
                      : i === 2
                        ? "bg-slate-50"
                        : "bg-kez-blue-light"
                    }`}
                >
                  <div
                    className={`mb-10 flex items-start justify-between ${i === 0 ? "text-kez-yellow" : "text-kez-blue"
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
                    className={`mt-3 text-sm leading-6 ${i === 0 ? "text-white/70" : "text-slate-600"
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
                Ready to find your voice?
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
  const [infoMsg, setInfoMsg] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [showResend, setShowResend] = useState(false)

  async function resendConfirmation() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMsg("Please enter your email above to resend the confirmation link.")
      return
    }
    setResending(true)
    setErrorMsg("")
    setInfoMsg("")
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
      })
      if (error) {
        setErrorMsg(error.message)
      } else {
        setInfoMsg("A fresh confirmation link has been sent! Check your inbox.")
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to resend confirmation.")
    } finally {
      setResending(false)
    }
  }

  async function forgotPassword() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMsg("Enter your email above, then click “Forgot password?” again.")
      return
    }
    setResending(true)
    setErrorMsg("")
    setInfoMsg("")
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      })
      if (error && /rate limit/i.test(error.message)) {
        setErrorMsg("Too many emails were sent recently. Please wait a while and try again.")
      } else {
        // Same message either way, so this can't be used to discover accounts.
        setInfoMsg("If an account exists for that email, a password reset link is on its way.")
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to send the reset email.")
    } finally {
      setResending(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setErrorMsg("")
    setInfoMsg("")

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
        setErrorMsg("Please confirm your email address before logging in.")
        setShowResend(true)
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
                Welcome back!
              </h2>
              <p className="mt-3 text-slate-500">
                Log in to continue your speaking journey.
              </p>
            </div>

            {banner && (
              <div
                className={`mb-6 rounded-2xl p-4 text-xs font-semibold leading-5 ${
                  banner.type === "error"
                    ? "border border-amber-200 bg-amber-50 text-amber-900"
                    : "border border-blue-200 bg-blue-50 text-blue-900"
                }`}
              >
                <p>{banner.message}</p>
              </div>
            )}

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

function PasswordRecovery({
  mode,
  authorized = false,
  status = "invalid",
  onLogin,
  onUpdated,
  onRequestReset,
}: {
  mode: "request" | "update"
  authorized?: boolean
  status?: "checking" | "ready" | "invalid" | "updated"
  onLogin: () => void
  onUpdated?: () => void
  onRequestReset?: () => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (loading) return
    setError("")
    setMessage("")
    if (mode === "request") {
      if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError("Please enter a valid email address.")
        return
      }
      setLoading(true)
      try {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (requestError) {
          setError("We couldn't process your request right now. Please check your connection and try again.")
          return
        }
        setSent(true)
        setMessage("If an account exists for this email address, a password reset link will be sent. Please check your inbox and spam folder.")
      } catch {
        setError("We couldn't connect to the account service. Check your connection and try again.")
      } finally {
        setLoading(false)
      }
      return
    }

    if (!authorized) {
      setError("Open the password reset link from your email to continue. The link may have expired; you can request another one.")
      return
    }
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Your passwords don't match.")
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError("We couldn't update your password. Your reset link may have expired; request a new one and try again.")
        return
      }
      setMessage("Your password has been updated. You can now log in with your new password.")
      onUpdated?.()
    } catch {
      setError("We couldn't connect to the account service. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10">
        <LoginLogo />
        <h1 className="mt-8 text-2xl font-extrabold text-kez-dark">
          {mode === "request" ? "Forgot your password?" : "Choose a new password"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {mode === "request"
            ? "Enter the email address on your account and we'll send you a reset link."
            : "Enter and confirm a new password for your KezSpeak account."}
        </p>
        <form onSubmit={submit} className="mt-7">
          {mode === "request" ? (
            <label className="block text-sm font-semibold text-slate-700">
              Email address
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-kez-blue" />
            </label>
          ) : status === "checking" ? (
            <div role="status" className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <span className="mr-3 inline-block size-4 animate-spin rounded-full border-2 border-blue-300 border-t-kez-blue align-middle" />
              Checking your password reset link...
            </div>
          ) : !authorized ? (
            <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              This password reset link is invalid or may have expired. Return to Forgot Password and request a new link.
            </p>
          ) : (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                New password
                <span className="relative mt-2 block">
                  <input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-12 outline-none focus:border-kez-blue" />
                  <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-3 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </span>
              </label>
              <label className="mt-5 block text-sm font-semibold text-slate-700">
                Confirm new password
                <span className="relative mt-2 block">
                  <input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-12 outline-none focus:border-kez-blue" />
                  <button type="button" onClick={() => setShowConfirmPassword((shown) => !shown)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} className="absolute inset-y-0 right-3 text-slate-500">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </span>
              </label>
            </>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
          {message && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>}
          {!sent && !(mode === "update" && message) && (mode === "request" || authorized) && (
            <button disabled={loading} className="mt-7 flex h-13 w-full items-center justify-center rounded-xl bg-kez-blue text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 disabled:opacity-75">
              {loading ? "Please wait..." : mode === "request" ? "Send reset link" : "Update password"}
            </button>
          )}
          <button type="button" onClick={onLogin} className="mt-6 w-full text-center text-sm font-bold text-kez-blue">
            Back to log in
          </button>
          {mode === "update" && status === "invalid" && onRequestReset && (
            <button type="button" onClick={onRequestReset} className="mt-3 w-full text-center text-sm font-semibold text-slate-600">
              Request another reset link
            </button>
          )}
        </form>
      </div>
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
  const [confirmationEmail, setConfirmationEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setErrorMsg("")

    const normalizedName = fullName.trim()
    const normalizedEmail = email.trim()

    if (!normalizedName) {
      setErrorMsg("Please enter your full name.")
      return
    }
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
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
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: normalizedName },
          emailRedirectTo: window.location.origin,
        },
      })

      console.log("[KezSpeak] Signup response", {
        userId: data?.user?.id ?? null,
        email: data?.user?.email ?? null,
        identitiesCount: data?.user?.identities?.length ?? null,
        hasSession: !!data?.session,
        error: error
          ? { message: error.message, status: error.status, code: error.code }
          : null,
      })

      if (error) {
        const message = error.message.toLowerCase()
        setErrorMsg(
          message.includes("already registered") || message.includes("already exists")
            ? "An account with this email already exists."
            : message.includes("password")
              ? "Password does not meet the required requirements."
              : "Unable to create your account. Please try again.",
        )
        return
      }

      if (!data.user) {
        console.warn("[KezSpeak] Signup returned no user and no error")
        setErrorMsg("Unable to create your account. Please try again.")
        return
      }

      if (data.user.identities?.length === 0) {
        setErrorMsg("An account with this email may already exist. Try logging in or resetting your password.")
        return
      }

      if (!data.session) {
        setConfirmationEmail(data.user.email ?? normalizedEmail)
        setCreated(true)
      }
    } catch (error) {
      console.error("[KezSpeak] Signup request failed:", {
        message: error instanceof Error ? error.message : "Unknown request error",
      })
      setErrorMsg(
        "Unable to reach the account service. Check your connection and try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function resendConfirmation() {
    if (!confirmationEmail || resendLoading || resendCooldown > 0) return
    setResendLoading(true)
    setResendMessage("")
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) {
        setResendMessage("We couldn't send the confirmation email. Please try again later.")
      } else {
        setResendMessage("Confirmation email sent.")
        setResendCooldown(30)
      }
    } catch {
      setResendMessage("We couldn't send the confirmation email. Please try again later.")
    } finally {
      setResendLoading(false)
    }
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
                  We've sent a confirmation link to:
                </p>
                <p className="mt-2 break-all text-sm font-bold text-kez-dark">
                  {confirmationEmail}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Please check your inbox and click the link before logging in.
                </p>
                <button
                  onClick={onLogin}
                  className="mt-7 h-13 w-full rounded-xl bg-kez-blue text-sm font-bold text-white shadow-lg shadow-blue-900/15"
                >
                  Back to Login
                </button>
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={resendLoading || resendCooldown > 0}
                  className="mt-4 text-sm font-bold text-kez-blue disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resendLoading
                    ? "Sending..."
                    : resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : "Resend confirmation email"}
                </button>
                {resendMessage && (
                  <p role="status" className="mt-2 text-sm text-slate-600">
                    {resendMessage}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-4xl font-extrabold tracking-[-.045em] text-kez-dark">
                    Create your account
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

const studentNav: NavItem[] = [
  ["dashboard", LayoutDashboard, "Dashboard"],
  ["assessment", ClipboardCheck, "My Assessment"],
  ["activities", MessageCircle, "Speaking Activities"],
  ["feedback", MessageSquare, "Feedback"],
  ["progress", TrendingUp, "My Progress"],
  ["results", BarChart3, "Results"],
  ["profile", User, "Profile"],
]
function StudentApp({ onExit }: { onExit: () => void }) {
  const { profile, signOut } = useAuth()
  const firstName = profile?.full_name?.split(" ")[0] ?? "there"
  const avatarLetter = profile?.full_name?.[0]?.toUpperCase() ?? "?"
  const [page, setPage] = useState("dashboard")
  const [taskId, setTaskId] = useState<string | null>(null)
  const { submissions, error, reload } = useSubmissionList(profile?.id)
  // Refresh when switching pages so new recordings and feedback show up.
  useEffect(reload, [page, reload])

  const startTask = (id: string | null) => {
    setTaskId(id)
    setPage("activity")
  }
  const titles: Record<string, string> = {
    dashboard: `${greeting()}, ${firstName}! 👋`,
    assessment: "My Speaking Assessment",
    activities: "Speaking Activities",
    activity: "Speaking Task",
    feedback: "Your Feedback",
    progress: "My Speaking Progress",
    results: "My Results",
    profile: "Your Profile",
  }
  return (
    <DashboardLayout
      brand={<Brand dark />}
      workspaceLabel="My space"
      eyebrow="KezSpeak Student"
      title={titles[page]}
      nav={studentNav}
      isActive={(id) => page === id || (id === "activities" && page === "activity")}
      onNavigate={setPage}
      userName={profile?.full_name ?? "Student"}
      userSubtitle="Learner"
      avatarLetter={avatarLetter}
      onSignOut={signOut}
    >
      <div className="mx-auto max-w-[1240px] p-4 sm:p-6 lg:p-10">
        {page === "dashboard" && (
          <StudentDashboard submissions={submissions} error={error} onNavigate={setPage} onStartTask={startTask} />
        )}
        {page === "assessment" && (
          <AssessmentPath submissions={submissions} error={error} onNavigate={setPage} onStartTask={startTask} />
        )}
        {page === "activities" && <TaskCatalog onStart={startTask} />}
        {page === "activity" && profile && (
          <RecordActivity
            key={taskId ?? "default"}
            learnerId={profile.id}
            initialTaskId={taskId}
            onViewResults={() => setPage("results")}
          />
        )}
        {(page === "feedback" || page === "progress" || page === "results") && profile && (
          <AssessmentResults learnerId={profile.id} onRecord={() => startTask(null)} />
        )}
        {page === "profile" && profile && <ProfileCard profile={profile} submissions={submissions} />}
      </div>
    </DashboardLayout>
  )
}

function TutorApp({ onExit }: { onExit: () => void }) {
  const { profile, signOut } = useAuth()
  const firstName = profile?.full_name?.split(" ")[0] ?? "there"
  const avatarLetter = profile?.full_name?.[0]?.toUpperCase() ?? "?"
  const [page, setPage] = useState("dashboard")
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [learnerId, setLearnerId] = useState<string | null>(null)
  const isSuperAdmin = profile?.role === "super_admin"
  const { submissions, error, reload } = useSubmissionList()
  useEffect(reload, [page, reload])
  const pendingCount = submissions?.filter(needsReview).length ?? 0

  const nav: NavItem[] = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ...(isSuperAdmin
      ? ([
          ["users", ShieldCheck, "Users"],
          ["assignments", Link2, "Assignments"],
          ["tasks", ListChecks, "Tasks"],
        ] as NavItem[])
      : []),
    ["learners", Users, "Learners"],
    ["submissions", ClipboardCheck, "Assessments"],
    ["activities", MessageCircle, "Speaking Activities"],
    ["review", Headphones, "Submissions"],
    ["feedback", MessageSquare, "Feedback"],
    ["progress", TrendingUp, "Progress"],
    ["reports", BarChart3, "Reports"],
    ["profile", User, "Profile"],
  ]
  const titles: Record<string, string> = {
    dashboard: `${greeting()}, ${firstName}! 👋`,
    users: "User Accounts",
    assignments: "Tutor Assignments",
    tasks: "Speaking Tasks",
    learners: "My Learners",
    submissions: "Assessment Submissions",
    activities: "Speaking Activities",
    review: "Speaking Assessment Review",
    feedback: "Feedback",
    progress: "Speaking Progress Comparison",
    reports: "Learner Reports",
    profile: "Your Profile",
  }
  const navigate = (next: string) => {
    if (next !== page) setReviewId(null)
    setPage(next)
  }
  return (
    <DashboardLayout
      brand={<Brand dark />}
      workspaceLabel={isSuperAdmin ? "Super admin workspace" : "Tutor workspace"}
      eyebrow="KezSpeak Tutor"
      title={titles[page]}
      nav={nav}
      isActive={(id) => page === id}
      onNavigate={navigate}
      badges={pendingCount ? { review: String(pendingCount) } : undefined}
      userName={profile?.full_name ?? "Tutor"}
      userSubtitle={isSuperAdmin ? "Super Admin" : "Tutor & Assessor"}
      avatarLetter={avatarLetter}
      onSignOut={signOut}
    >
      <div className="mx-auto max-w-[1280px] p-4 sm:p-6 lg:p-10">
        {page === "dashboard" && (
          <TutorDashboard
            submissions={submissions}
            error={error}
            onReview={(id) => {
              setReviewId(id)
              setPage("review")
            }}
          />
        )}
        {page === "learners" && (
          <LearnerOverview
            submissions={submissions}
            error={error}
            onOpen={(id) => {
              setLearnerId(id)
              setPage("progress")
            }}
          />
        )}
        {(page === "submissions" || page === "review" || page === "feedback") && profile && (
          <SubmissionReview key={`${page}-${reviewId}`} tutorId={profile.id} initialSelectedId={reviewId} onChanged={reload} />
        )}
        {page === "activities" && <TaskCatalog />}
        {isSuperAdmin && page === "users" && profile && <UserManagement currentUserId={profile.id} />}
        {isSuperAdmin && page === "assignments" && <AssignmentManagement />}
        {isSuperAdmin && page === "tasks" && <TaskManagement />}
        {(page === "progress" || page === "reports") && (
          <LearnerProgress submissions={submissions} error={error} learnerId={learnerId} onSelect={setLearnerId} />
        )}
        {page === "profile" && profile && <ProfileCard profile={profile} submissions={submissions} />}
      </div>
    </DashboardLayout>
  )
}

const ROLES: Profile["role"][] = ["student", "tutor", "admin", "super_admin"]

// Super admins use the admin workspace (same URL and dashboard as admins).
const homePathFor = (role: Profile["role"]) =>
  role === "tutor" ? "/tutor" : role === "admin" || role === "super_admin" ? "/admin" : "/student"
const viewFor = (role: Profile["role"]): View =>
  role === "tutor" ? "tutor" : role === "admin" || role === "super_admin" ? "admin" : "student"

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [view, setView] = useState<View>("landing")
  const [noProfile, setNoProfile] = useState(false)
  // Arrived from an invite or password-reset email: choose a password first.
  const [mustSetPassword, setMustSetPassword] = useState(arrivedToSetPassword)
  const [authBanner, setAuthBanner] = useState<{
    type: "error" | "info" | "success"
    message: string
  } | null>(null)
  const [path, setPath] = useState(() => window.location.pathname)
  const [recoveryStatus, setRecoveryStatus] = useState<"checking" | "ready" | "invalid" | "updated">(
    () => window.location.pathname === "/reset-password" ? "checking" : "invalid",
  )
  const recoveryEventSeen = useRef(false)

  const navigate = (nextPath: string, replace = false) => {
    if (window.location.pathname !== nextPath) window.history[replace ? "replaceState" : "pushState"]({}, "", nextPath)
    setPath(nextPath)
  }

  const signOut = async () => {
    console.log("[KezSpeak] Signing out")
    await supabase.auth.signOut()
    setRecoveryStatus("invalid")
    setUser(null)
    setProfile(null)
    setAuthState("unauthenticated")
    setView("login")
    setNoProfile(false)
    setAuthBanner(null)
    navigate("/login", true)
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[KezSpeak] Auth event:", event, "user:", session?.user?.id ?? null)
        window.setTimeout(() => {
          void (async () => {
        const { data: { user: authenticatedUser } } = await supabase.auth.getUser()
        if (!authenticatedUser) {
          setUser(null)
          setProfile(null)
          setAuthState("unauthenticated")
          setNoProfile(false)
          return
        }
        if (authenticatedUser) {
          setUser(authenticatedUser)
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authenticatedUser.id)
            .single()

          console.log("[KezSpeak] Profile lookup — data:", data, "error:", error?.message ?? null)

          if (error && (error.message.includes("relation") || error.message.includes("does not exist"))) {
            setProfile(null)
            setAuthState("unauthenticated")
            setNoProfile(true)
            return
            console.warn("[KezSpeak] profiles table missing — defaulting to student role")
            const fallbackProfile: Profile = {
              id: authenticatedUser!.id,
              full_name: authenticatedUser!.user_metadata?.full_name ?? authenticatedUser!.email ?? "User",
              email: authenticatedUser!.email ?? "",
              role: "student",
            }
            setProfile(fallbackProfile)
            setAuthState("authenticated")
            setNoProfile(false)
            setView("student")
            return
          }

          if (!data || error) {
            console.warn("[KezSpeak] No profile found for the authenticated user")
            setAuthState("unauthenticated")
            setNoProfile(true)
            return
          }

            const role = data.role as Profile["role"]
            if (!ROLES.includes(role)) {
              console.warn("[KezSpeak] Unknown role on profile:", role)
              showNoProfile()
              return
            }
            console.log("[KezSpeak] Detected role:", role, "→ redirecting to", homePathFor(role))
            setProfile(data as Profile)
            setAuthState("authenticated")
            setNoProfile(false)
            setView(viewFor(role))
          } catch (err) {
            console.error("[KezSpeak] Error during profile lookup:", err)
            showNoProfile()
          }
        })()
      }, 0)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (path === "/reset-password") return
    if (authState === "authenticated" && profile) {
      const ownPath = homePathFor(profile.role)
      if (path !== ownPath) navigate(ownPath, true)
      return
    }
    if (authState === "unauthenticated" && !noProfile && ["/student", "/tutor", "/admin"].includes(path)) {
      navigate("/login", true)
    }
  }, [authState, noProfile, path, profile])

  if (authState === "loading") return <LoadingScreen />

  if (path === "/reset-password" || recoveryStatus === "ready" || recoveryStatus === "updated") {
    return (
      <PasswordRecovery
        mode="update"
        authorized={recoveryStatus === "ready" || recoveryStatus === "updated"}
        status={recoveryStatus}
        onLogin={() => void signOut()}
        onUpdated={() => setRecoveryStatus("updated")}
        onRequestReset={() => navigate("/forgot-password")}
      />
    )
  }

  if (noProfile)
    return <NoProfileScreen onSignOut={signOut} />

  const authValue = { user, profile, role: profile?.role ?? null, loading: false, signOut }

  if (authState === "authenticated" && mustSetPassword)
    return (
      <SetPasswordScreen
        name={profile?.full_name?.split(" ")[0] ?? "there"}
        invited={arrivedFromInvite}
        onDone={() => setMustSetPassword(false)}
      />
    )

  if (authState === "authenticated") {
    if (view === "tutor" || view === "admin")
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

  if (path === "/login") {
    return (
      <Login
        onBack={() => navigate("/")}
        onSignup={() => navigate("/signup")}
      />
    )
  }
  if (path === "/forgot-password") {
    return <PasswordRecovery mode="request" onLogin={() => navigate("/login")} />
  }
  if (path === "/signup") {
    return (
      <Signup
        onBack={() => navigate("/")}
        onLogin={() => navigate("/login")}
      />
    )
  }
  return (
    <Landing
      onLogin={() => navigate("/login")}
      onSignup={() => navigate("/signup")}
    />
  )
}

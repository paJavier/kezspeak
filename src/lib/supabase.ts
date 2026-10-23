import { createClient } from "@supabase/supabase-js"

// Both values come from .env.local. Never hard-code keys in source files.
const rawUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local (see .env.example).",
  )
}

const supabaseUrl = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "")

// Invite and password-reset emails land here with `#...&type=invite|recovery`.
// Read it before createClient, which consumes the hash to start the session.
const linkType = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.slice(1)).get("type") : null
export const arrivedToSetPassword = linkType === "invite" || linkType === "recovery"
export const arrivedFromInvite = linkType === "invite"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  full_name: string
  email: string
  role: "student" | "tutor" | "admin" | "super_admin"
  avatar_url?: string
}

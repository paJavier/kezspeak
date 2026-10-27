import { createClient } from "@supabase/supabase-js"

// Both values come from .env.local. Never hard-code keys in source files.
const rawUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local (see .env.example).",
  )
}

// Accept either a project URL or the REST endpoint URL from Supabase settings.
const supabaseUrl = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "")

// Capture the link type before createClient consumes an implicit-flow fragment.
const linkType =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.hash.slice(1)).get("type")
    : null

export const arrivedToSetPassword = linkType === "invite" || linkType === "recovery"
export const arrivedFromInvite = linkType === "invite"

// Supabase's configured redirect may use an implicit fragment or a PKCE code.
// Select PKCE for code callbacks and retain implicit handling for token fragments.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType:
      typeof window !== "undefined" && new URLSearchParams(window.location.search).has("code")
        ? "pkce"
        : "implicit",
    detectSessionInUrl: true,
  },
})

export type Profile = {
  id: string
  full_name: string
  email: string
  role: "student" | "tutor" | "admin" | "super_admin"
  avatar_url?: string
}

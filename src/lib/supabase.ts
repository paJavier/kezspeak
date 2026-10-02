import { createClient } from "@supabase/supabase-js"
import { projectId, publicAnonKey } from "../../utils/supabase/info"

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "")
const supabaseUrl = configuredUrl || `https://${projectId}.supabase.co`
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
)

export type Profile = {
  id: string
  full_name: string
  email: string
  role: "student" | "tutor" | "admin"
  avatar_url?: string
}

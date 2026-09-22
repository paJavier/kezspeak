import { createClient } from "@supabase/supabase-js"
import { projectId, publicAnonKey } from "../../utils/supabase/info"

const supabaeURL = import.meta.env.VITE_SUPABASE_URL;
const supabaseKEY = import.meta.env.VITE_SUPABASE_ANON_KEY;


export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
)

export type Profile = {
  id: string
  full_name: string
  email: string
  role: "student" | "tutor" | "admin"
  avatar_url?: string
}

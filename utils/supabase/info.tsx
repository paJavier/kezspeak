/* Supabase connection values live in .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
   Do not paste keys into this file. src/lib/supabase.ts reads the environment directly. */

const url: string = import.meta.env.VITE_SUPABASE_URL ?? ""

export const projectId = url.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? ""
export const publicAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""

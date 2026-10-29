# KezSpeak: deployment checklist

Target: **Vercel** (web app) + a **Hugging Face Space** (ml-service) + the existing hosted **Supabase** project.
Work top to bottom and tick each box. Anything marked ⚠ blocks go-live.

```
Browser ──► Vercel (Vite build, VITE_* only)
   │  Supabase JWT
   ├──────► Supabase (Postgres + Auth + Storage, RLS)
   └──────► HF Space: ml-service (Whisper, features, XGBoost, Gemini) ──► Supabase (service role)
Supabase Edge Function (AI fallback feedback) ──► Gemini / ml-service
```

## 1. Before deploying (local gates)

- [ ] ⚠ `npm test` passes
- [ ] ⚠ `npm run build` passes
- [ ] ⚠ `cd ml-service; .venv\Scripts\python -m pytest` passes
- [ ] `git status` is clean and `main` is pushed
- [ ] ⚠ `git lfs ls-files` lists nothing under `public/` or `ml-service/model/` (`.gitattributes` excludes them). Vercel builds from a plain clone and would serve 130-byte LFS pointers instead of images
- [ ] No secrets in source: `git grep -nE "service_role|AIza|sk_live"` finds nothing. Only the public **anon** key has ever appeared in git history (checked 29 Oct 2026); that key is public by design.
- [ ] `utils/supabase/info.tsx` still reads env vars (Figma Make can regenerate it with literal values)

## 2. Supabase (hosted project)

- [ ] ⚠ Every migration in [SETUP.md §7](SETUP.md#7-database-supabase) has been run **in order**, including the latest `20261102_announcement_audience.sql`
- [ ] ⚠ Table Editor: RLS is **enabled** on every `public` table
- [ ] ⚠ Storage: the `recordings` bucket is **private**
- [ ] At least one `super_admin` exists (bootstrap SQL in SETUP.md)
- [ ] Authentication → URL Configuration:
  - [ ] **Site URL** = the Vercel production URL
  - [ ] **Redirect URLs** include the Vercel URL and `https://<vercel-url>/reset-password`
- [ ] ⚠ Custom SMTP is enabled (built-in mail only reaches team members). See SETUP.md §8.
- [ ] Email templates (invite, recovery) are pasted in
- [ ] Edge Function `make-server-8450f8e5` is deployed: `supabase functions deploy make-server-8450f8e5`
- [ ] Edge Function secrets are set: `GEMINI_API_KEY`, `KEZSPEAK_ML_URL` (the Space URL), `KEZSPEAK_API_KEY`
- [ ] Backups: confirm the plan's daily backups, or export the schema and data before launch

## 3. Hugging Face Space: ml-service

Free CPU Space (16 GB RAM, Docker). `ml-service/Dockerfile` installs Java (grammar counts), spaCy's model, and pre-downloads Whisper small and LanguageTool at build time.

- [ ] On huggingface.co: **New Space** → SDK **Docker** → hardware **CPU basic** (free) → visibility **Public** (the browser calls it directly; secrets stay hidden)
- [ ] `hf auth login` with a **write** token
- [ ] Upload from the repo root (uses your working copy, so the real `.pkl` files go up):
  ```
  hf upload <user>/<space> ml-service . --repo-type space
  hf upload <user>/<space> ml-service/hf-space.md README.md --repo-type space
  ```
- [ ] Space → Settings → **Variables and secrets** (secrets, no `VITE_` prefix, never in the frontend):

  | Name | Value |
  |---|---|
  | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
  | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API |
  | `KEZSPEAK_API_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"`, same value as the Edge Function secret |
  | `GEMINI_API_KEY` | Google AI Studio key (AI comparison, activity drafts) |
  | `ALLOWED_ORIGINS` | the Vercel URL(s), comma-separated, no trailing slash |

- [ ] ⚠ `https://<user>-<space>.hf.space/health` returns `"status": "ok"` and the model shows as loaded
- [ ] Note: a free Space **sleeps after ~48 h without traffic**; the next request wakes it (1–2 min). Recordings sent while it sleeps are saved and can be retried. Open `/health` before a class or demo.
- [ ] Note: a restart marks in-flight recordings as **failed (retryable)**; learners and tutors can retry without recording again. Avoid redeploying during class hours.

## 4. Vercel: web app

- [ ] Import the GitHub repo; framework **Vite**. `vercel.json` sets the build, output `dist` and the SPA rewrite (needed for `/reset-password`).
- [ ] Node 22 (matches `.mise.toml`)
- [ ] Environment variables (these are bundled into the browser, so public values only):

  | Name | Value |
  |---|---|
  | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
  | `VITE_SUPABASE_ANON_KEY` | the **anon** key only |
  | `VITE_ML_API_URL` | the Space URL (`https://<user>-<space>.hf.space`), no trailing slash. Build-time: redeploy after changing it |

- [ ] ⚠ Nothing secret is in a `VITE_*` variable (`SUPABASE_SERVICE_ROLE_KEY`, `KEZSPEAK_API_KEY` and `GEMINI_API_KEY` never go here)
- [ ] After the first deploy, add the final Vercel URL to the Space's `ALLOWED_ORIGINS` (the Space restarts) and to Supabase Redirect URLs
- [ ] ⚠ `curl -sI https://<vercel-url>/images/logo-mark.png` shows `Content-Length: 97955`, not ~130 (an LFS pointer)

## 5. Smoke test on production (one account per role)

**Student**
- [ ] Sign up, confirm email, log in
- [ ] Record a practice task → status moves through processing → result shows as machine-generated information
- [ ] Pre-assessment works only when it was assigned
- [ ] Results page: tutor feedback is visible; pre/post comparison appears after a post-assessment
- [ ] Forgot password → email arrives → `/reset-password` link works

**Tutor / Teacher**
- [ ] Sees only their own students (Learners, Submissions, Statistics)
- [ ] Reviews a submission, adds feedback → the student gets a notification
- [ ] AI comparison runs on a completed submission
- [ ] Tasks → Draft with AI: upload a PDF, a DOCX and a TXT → draft → Use this draft → Create task
- [ ] Announcement reaches **only their students**

**Moderator (`admin`) and Administrator (`super_admin`)**
- [ ] Announcement to **Everyone** reaches a student and a tutor
- [ ] Announcement to **All tutors** does not reach students
- [ ] Administrator: Users page can invite a user, set a student's tutor, resend an invite

**Failure paths**
- [ ] Stop ml-service briefly → the learner sees the "saved, can be processed later" message; Retry works once it is back
- [ ] AI fallback feedback (violet card) appears only after consent and shows no score

## 6. Research and wording check

- [ ] Scores are described as machine-generated assessment information that a tutor reviews
- [ ] No CEFR level or proficiency label is shown as fact
- [ ] Every AI output (fallback feedback, AI comparison, activity drafts) is labeled as AI-generated and never feeds evaluations, scores or pre/post
- [ ] `/health` reports model version `kezspeak-xgb-audio-v1`; results record the model and feature versions

## 7. After go-live

- [ ] Rotate any key that was shared in chat or email during development (`SUPABASE_SERVICE_ROLE_KEY`, `KEZSPEAK_API_KEY`, `GEMINI_API_KEY`)
- [ ] Set a Google Cloud budget alert for the Gemini key
- [ ] Watch the Space logs for the first real submissions (STT ≤ 30 s, end-to-end about 60 s or less)
- [ ] Record the production URLs and who holds dashboard access somewhere private

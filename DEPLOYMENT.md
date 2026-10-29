# KezSpeak: deployment checklist

Target: **Vercel** (web app) + **Render** (ml-service) + the existing hosted **Supabase** project.
Work top to bottom and tick each box. Anything marked ⚠ blocks go-live.

```
Browser ──► Vercel (Vite build, VITE_* only)
   │  Supabase JWT
   ├──────► Supabase (Postgres + Auth + Storage, RLS)
   └──────► Render: ml-service (Whisper, features, XGBoost, Gemini) ──► Supabase (service role)
Supabase Edge Function (AI fallback feedback) ──► Gemini / ml-service
```

## 1. Before deploying (local gates)

- [ ] ⚠ `npm test` passes
- [ ] ⚠ `npm run build` passes
- [ ] ⚠ `cd ml-service; .venv\Scripts\python -m pytest` passes
- [ ] `git status` is clean and `main` is pushed
- [ ] `git lfs ls-files` lists both `ml-service/model/*.pkl` files (the host must get the real files, not LFS pointers)
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
- [ ] Edge Function secrets are set: `GEMINI_API_KEY`, `KEZSPEAK_ML_URL` (the Render URL), `KEZSPEAK_API_KEY`
- [ ] Backups: confirm the plan's daily backups, or export the schema and data before launch

## 3. Render: ml-service

- [ ] New **Web Service** from the GitHub repo, **Root Directory** `ml-service`
- [ ] Runtime Python **3.11** (set `PYTHON_VERSION=3.11.11`)
- [ ] Build: `pip install -r requirements.txt && python -m spacy download en_core_web_sm`
- [ ] Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] ⚠ Instance with **at least 2 GB RAM** (Whisper small + XGBoost + spaCy). The free 512 MB tier cannot load Whisper.
- [ ] Grammar counts need Java. Render's native Python runtime has no Java, so either:
  - set `ENABLE_GRAMMAR=false` (grammar error count is then missing from the NLP features; the score is audio-only and unaffected), or
  - deploy with a Dockerfile that installs a JRE 17
- [ ] Environment variables (no `VITE_` prefix, never in the frontend):

  | Name | Value |
  |---|---|
  | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
  | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API |
  | `KEZSPEAK_API_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"`, same value as the Edge Function secret |
  | `GEMINI_API_KEY` | Google AI Studio key (AI comparison, activity drafts) |
  | `ALLOWED_ORIGINS` | the Vercel URL(s), comma-separated, no trailing slash |
  | `ENABLE_GRAMMAR` | `false` unless Java is installed |

- [ ] ⚠ `https://<render-url>/health` returns `"status": "ok"` and the model shows as loaded
- [ ] Health check path set to `/health`
- [ ] Note: a restart marks in-flight recordings as **failed (retryable)**; learners and tutors can retry without recording again. Avoid deploying during class hours.

## 4. Vercel: web app

- [ ] Import the GitHub repo; framework **Vite**. `vercel.json` sets the build, output `dist` and the SPA rewrite (needed for `/reset-password`).
- [ ] Node 22 (matches `.mise.toml`)
- [ ] Environment variables (these are bundled into the browser, so public values only):

  | Name | Value |
  |---|---|
  | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
  | `VITE_SUPABASE_ANON_KEY` | the **anon** key only |
  | `VITE_ML_API_URL` | the Render URL, no trailing slash |

- [ ] ⚠ Nothing secret is in a `VITE_*` variable (`SUPABASE_SERVICE_ROLE_KEY`, `KEZSPEAK_API_KEY` and `GEMINI_API_KEY` never go here)
- [ ] After the first deploy, add the final Vercel URL to Render `ALLOWED_ORIGINS` and Supabase Redirect URLs, then redeploy Render

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
- [ ] Watch Render logs for the first real submissions (STT ≤ 30 s, end-to-end about 60 s or less)
- [ ] Record the production URLs and who holds dashboard access somewhere private

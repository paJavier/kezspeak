# KezSpeak: team setup guide

How to get KezSpeak running on your own laptop, from a fresh clone to recording and reviewing a speaking assessment. Written for Windows; macOS/Linux notes are inline.

## 1. What's in this repo

| Part | Folder | What it does | Runs on |
|---|---|---|---|
| Web app | `src/` | React 19 + Vite + Tailwind. Learner, tutor and admin dashboards | http://localhost:8443 |
| ML service | `ml-service/` | Python FastAPI. Whisper transcript → 40 acoustic + 15 NLP features → XGBoost score. Also account management and the Gemini comparison | http://localhost:8000 |
| Database & auth | `supabase/` | Email templates, an Edge Function (not deployed yet). SQL migrations are shared privately, not in git | Our shared Supabase project (cloud) |

**Flow:** the learner records in the browser → audio goes to Supabase Storage → the browser asks the ML service to process it → the ML service writes the transcript, features and score back to Supabase → the learner and tutor see the result.

You need **both** the web app and the ML service running. Without the ML service, recordings stay "Uploaded" and the Users page can't load.

## 2. Install these first

| Tool | Version | Notes |
|---|---|---|
| Git | any | |
| Git LFS | any | Downloads the model files. Run `git lfs install` once **before** cloning (if you forgot, run `git lfs pull` afterwards) |
| Node.js | **22** | https://nodejs.org. Check with `node -v` |
| Python | **3.11** | https://www.python.org/downloads/. On the first installer screen tick **"Add python.exe to PATH"**. The Microsoft Store "python" will not work. |
| Java (optional) | 17+ | Only for grammar-error counts. Skip it on low-RAM laptops (see §6) |

**Hardware:** about 3 GB free disk (Whisper downloads about 500 MB the first time). With 8 GB RAM, close Steam, Discord and extra browser tabs while the ML service runs; it uses 2–4 GB.

## 3. Get the code

```powershell
git lfs install
git clone https://github.com/paJavier/kezspeak.git
cd kezspeak
```

Everything is on `main`. If you cloned earlier, update with `git checkout main` and then `git pull`.

## 4. Create your `.env.local` (keys)

All keys live in **one file at the repo root: `.env.local`**. Git ignores it, and it must never be committed.

```powershell
copy .env.example .env.local
```

Then fill in the values. **Get them privately from the teammate who manages the keys** (in person, or a direct message you delete afterwards). Never paste them in a group chat, a GitHub issue or a commit.

| Variable | What it is | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Our Supabase project URL | Public |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key. Safe in the browser; the database's row-level security protects the data | Public |
| `VITE_ML_API_URL` | `http://localhost:8000` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access that bypasses all security rules. **ML service only** | 🔴 Secret |
| `KEZSPEAK_API_KEY` | Shared key for server-to-server `/evaluate` calls. You can generate your own (below) | 🔴 Secret |
| `GEMINI_API_KEY` | Google Gemini, for the tutor AI comparison | 🔴 Secret |
| `KEZSPEAK_ML_URL` | Leave empty (only for the Edge Function, later) | |

Generate your own `KEZSPEAK_API_KEY`:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

**Rule:** anything starting with `VITE_` is shipped to every visitor's browser, so a secret must **never** get a `VITE_` prefix.

## 5. Run the web app

```powershell
npm install
npm run dev
```

Open **http://localhost:8443**. Edits reload automatically.

## 6. Run the ML service (second terminal)

One-time setup:

```powershell
cd ml-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m spacy download en_core_web_sm
```

(macOS/Linux: use `python3`, and `.venv/bin/` instead of `.venv\Scripts\`.)

The trained model files are already in `ml-service/model/`.

Start it each time:

```powershell
cd ml-service
$env:ENABLE_GRAMMAR="false"; .venv\Scripts\uvicorn app.main:app --port 8000
```

- `ENABLE_GRAMMAR="false"` skips the Java grammar checker and saves about 0.6 GB of RAM. Leave it out if you installed Java and have RAM to spare.
- The first start downloads Whisper "small" (about 500 MB) and takes a minute. Wait for `Application startup complete.`
- Check it at http://localhost:8000/health. It should show `"loaded": true`.

Run the tests (with the service stopped, to save memory):

```powershell
$env:ENABLE_GRAMMAR="false"; .venv\Scripts\python -m pytest
```

(With grammar enabled, the tests start a Java LanguageTool server, which can hang on low-memory laptops.)

## 7. Database (Supabase)

We share **one** Supabase project, and **all migrations are already applied**. Don't run them again.

The SQL files are **not on GitHub** (`supabase/migrations/` is git-ignored). If you ever need them, for example for a brand-new Supabase project, get them privately from a teammate, put them in `supabase/migrations/`, and run them in date order in **Supabase → SQL Editor**:

| File | Adds |
|---|---|
| `20261023_assessment_pipeline.sql` | Tasks, assignments, submissions, evaluations, tutor feedback, `recordings` bucket, row-level security |
| `20261024_ai_feedback.sql` | Gemini fallback feedback for learners (Edge Function, not deployed yet) |
| `20261025_ai_comparisons.sql` | Tutor-only model-vs-Gemini comparison |
| `20261026_super_admin.sql` | `super_admin` role, role-change guard |
| `20261027_profile_on_signup.sql` | Creates a profile for every new account automatically |
| `20261027b_notifications.sql` | Notifications, announcements, notification triggers, realtime |
| `20261028_classwork.sql` | Tutor rosters, assignment deadlines, grades, missing-work marking |
| `20261029_statistics.sql` | Sign-up dates for the Statistics page |
| `20261030_simplify.sql` | One tutor per student, set from the Users page |
| `20261031_notification_fixes.sql` | Notifications follow each student's tutor (practice recordings, feedback, announcements) |
| `20261031b_fix_signup.sql` | Removes a duplicate sign-up trigger that made every account creation fail |
| `20261031c_announcement_policy.sql` | Records the live rule that only admins publish announcements |
| `20261101_research_guards.sql` | Pre/post only when assigned, task permissions, re-assigning practice |
| `20261101b_guard_order.sql` | Duplicate-assignment check no longer reveals other students' tasks to unauthorized users |
| `20261102_announcement_audience.sql` | Announcements: administrators/moderators pick Everyone, All students or All tutors; tutors post to their own students only |
| `20261103_require_tutor.sql` | Students get tasks, classwork and recordings only after a super admin sets their tutor |
| `20261104_exam_goals.sql` | Exam goals (IELTS / TOEFL / Cambridge), tutor rubric scores on feedback, exam-style tasks with preparation time |

Make someone an Administrator (SQL editor; the database value is `super_admin`):

```sql
update public.profiles set role = 'super_admin' where email = 'their@email.com';
```

## 8. Supabase dashboard settings (whoever has access; once)

1. **Authentication → URL Configuration → Redirect URLs:** add `http://localhost:8443`. Without this, invite and password-reset links won't return to the app.
2. **Project Settings → Authentication → SMTP Settings → Enable custom SMTP.** Supabase's built-in email reaches only project team members and allows only a few emails per hour. Use a dedicated Gmail account with an [App Password](https://myaccount.google.com/apppasswords):
   - Host `smtp.gmail.com`, port `465`
   - Username: the Gmail address; password: the 16-character app password
   - Sender name: `Kez Tutorial Service`
3. **Authentication → Rate Limits:** raise the emails-per-hour limit to about 30.
4. **Authentication → Email Templates:**
   - **Invite user:** subject `Your KezSpeak account invitation - Kez Tutorial Service`, body from `supabase/templates/invite.html`
   - **Reset Password:** subject `Reset your KezSpeak password`, body from `supabase/templates/recovery.html`

## 9. Try the full flow

1. Log in as an **Administrator** (database role `super_admin`). You'll see Users in the sidebar.
2. **Users → Create an account.** Leave "Send an invite email" on (needs §8) or untick it and set a temporary password. Create one **Tutor / Teacher** and one **Student**.
3. **Users → set the student's tutor** with the "Tutor" dropdown. Tutors only see their own students. Then, as the tutor, **Classwork → + Create assignment**.
4. Log in as the **student** → Speaking Activities → Start → record about 30–60 s → Submit. The status moves through *Transcribing → Measuring → Scoring → Ready* (20–30 s).
5. Log in as the **tutor** → Submissions → open the recording. You'll see the audio, transcript, metrics, machine estimate and **AI comparison**; add feedback or adjust the score.
6. The student sees the tutor's feedback under Results and Feedback.

Other features: dark mode (🌙 in the header), "Forgot password?" on the login page, and "Change password" under Profile.

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| "The assessment service is not reachable" / Users page won't load | The ML service isn't running. Start it (§6) |
| ML service crashes with `mkl_malloc: failed to allocate memory` or `MemoryError` | Out of RAM. Close other apps; use `ENABLE_GRAMMAR="false"` |
| `npm run dev` / build crashes with exit code 134 | Out of memory. Close apps or stop the ML service briefly |
| Recording stuck on "Uploaded" | ML service was off when you submitted. Start it, open the recording, click **Try again** |
| "violates foreign key constraint submissions_learner_id_fkey" | Account has no profile. `20261027_profile_on_signup.sql` fixes it (already applied) |
| "Supabase's email limit was reached" | Custom SMTP not set up (§8). Meanwhile create users with a temporary password |
| AI comparison: "Gemini is unavailable" | Google is overloaded or the model was retired. Wait and retry; models are set in `GEMINI_MODEL` (see `.env.example`) |
| `Port 8443 is already in use` | Another dev server is running. Close it |
| CORS error calling `localhost:8000` | Your web app runs on a port not in `ALLOWED_ORIGINS` (defaults: 5173, 8443). Add it in `.env.local` |
| `python` not found / opens Microsoft Store | Reinstall Python 3.11 from python.org with "Add to PATH" ticked |

## 11. Security rules

- Never commit `.env.local` or paste keys anywhere public. `git status` must never show it.
- The **service-role key** and **Gemini key** stay on the server side (ML service). Never put them in `src/` or behind a `VITE_` prefix.
- If a secret leaks, rotate it immediately: Supabase → Project Settings → API (service role), Google AI Studio (Gemini), or generate a new `KEZSPEAK_API_KEY`.
- Only load model `.pkl` files from the team. Pickle files can run code when loaded.
- Known prototype limits: the dev server is visible on your local network (Vite `0.0.0.0`), the ML service only runs locally, and the Edge Function isn't deployed.

## 12. Where things are

- Project and research context: `.claude/agents/kezspeak.md`
- ML service details and endpoints: `ml-service/README.md`
- UI specs used to build the screens: `src/imports/pasted_text/`

# KezSpeak

A web app for assessing ESL speaking. It uses machine learning to support tutors at **Kez Tutorial Service**.

Learners record spoken answers to pre- and post-assessment tasks. The system transcribes each recording and measures acoustic and language features. It then produces a machine-generated pronunciation estimate. A tutor reviews it, adds feedback and can adjust the result. The machine score supports the tutor's judgment and never replaces it.

The core loop is: **Assess → Practice → Improve → Reassess → Measure**.

> Research and capstone project: Mapúa Malayan Colleges Mindanao, College of Computer and Information Science. It is also the IT103L Web Programming course project.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Before you start: checklist](#before-you-start-checklist)
4. [Install the tools](#1-install-the-tools)
5. [Get the code (with Git LFS)](#2-get-the-code-with-git-lfs)
6. [Add the keys](#3-add-the-keys-envlocal)
7. [Run the web app](#4-run-the-web-app-terminal-1)
8. [Run the ML service](#5-run-the-ml-service-terminal-2)
9. [Log in and try it](#6-log-in-and-try-it)
10. [Editing the code](#editing-the-code)
11. [Tests and checks](#tests-and-checks)
12. [Troubleshooting](#troubleshooting)
13. [Security rules](#security-rules)
14. [More documentation](#more-documentation)

---

## Features

| Role | What they can do |
|---|---|
| **Student** | Record and submit speaking tasks, follow processing status, view results and tutor feedback, compare pre and post results |
| **Tutor / Teacher** | Assign classwork with due dates and grade it, review their students' recordings (audio, transcript, features, machine estimate), give feedback, adjust scores, run the research-only Gemini comparison |
| **Staff** (`admin` in the database) | Same view as a tutor, across all learners |
| **Administrator** (`super_admin` in the database) | Everything above, plus account management (invite, edit, delete) and setting each student's tutor |

Also included: invite and password-reset emails, "Forgot password?", password change under Profile, dark mode and a responsive layout.

## How it works

```
Browser (React)  ──record──▶  Supabase Storage
      │                              │
      └──"process"──▶  ML service (FastAPI, localhost:8000)
                         Whisper small → 40 acoustic + 15 NLP features → XGBoost (0–100)
                                     │
                                     ▼
                         Supabase Postgres (status, transcript, evaluation)
```

| Part | Folder | Tech | Runs on |
|---|---|---|---|
| Web app | `src/` | React 19, Vite 8, TypeScript, Tailwind CSS v4 | http://localhost:8443 |
| ML service | `ml-service/` | Python 3.11, FastAPI, faster-whisper, librosa/Parselmouth, spaCy, XGBoost | http://localhost:8000 |
| Database and auth | `supabase/` | Supabase Auth, Postgres with row-level security, Storage, email templates | Shared Supabase project (cloud) |

**Both** the web app and the ML service must be running. Without the ML service, recordings stay at "Uploaded" and the admin Users page won't load.

---

## Before you start: checklist

### What GitHub gives you

| Part | In the repo? | Notes |
|---|---|---|
| Web app source (`src/`) | ✅ | All pages, dashboards and admin tools |
| ML service source (`ml-service/app/`, `tests/`, `scripts/`) | ✅ | Whisper, feature extraction, scoring, admin routes, Gemini comparison |
| Trained model (`ml-service/model/*.pkl`) | ✅ **via Git LFS** | Install Git LFS **before** cloning (step 2) |
| Email templates, Edge Function (`supabase/`) | ✅ | |
| `.env.example` (key names, no values) | ✅ | |

### What you must get privately from the team

Ask in person or by direct message. **Never** use a group chat, a GitHub issue or a commit.

| What | Why you need it |
|---|---|
| **Values for `.env.local`** | Without them, login, the ML service and the AI comparison don't work |
| **Supabase project access** (optional) | Only to change tables, email settings or templates. Ask the project owner to invite you |
| **SQL migration files** (optional) | Only to change the database structure or set up a new Supabase project. The shared project already has them applied |
| **Colab notebook and training data** (optional) | Only to retrain the model. Training happens in Google Colab, not in this repo |

### Hardware

- About **3 GB** of free disk space. Whisper downloads about 500 MB on its first start.
- **8 GB of RAM or more.** The ML service uses 2–4 GB, so close heavy apps while it runs.

---

## 1. Install the tools

| Tool | Version | Download | Check with |
|---|---|---|---|
| **Git** | any | https://git-scm.com | `git --version` |
| **Git LFS** | any | https://git-lfs.com (included with Git for Windows) | `git lfs version` |
| **Node.js** | **22** | https://nodejs.org | `node -v` |
| **Python** | **3.11** | https://www.python.org/downloads/. On the first installer screen, tick **"Add python.exe to PATH"**. The Microsoft Store Python will not work | `python --version` |
| Java *(optional)* | 17+ | https://adoptium.net | `java -version` |

Java is only needed for grammar-error counts. You can skip it and run with `ENABLE_GRAMMAR=false`, which also saves RAM.

Recommended editor: **VS Code** with the Python, ESLint and Tailwind CSS IntelliSense extensions.

## 2. Get the code (with Git LFS)

The trained model files are stored with **Git LFS**. Turn LFS on **once per computer**, then clone:

```powershell
git lfs install
git clone https://github.com/paJavier/kezspeak.git
cd kezspeak
```

Check that the model files downloaded properly. They should be about 1 MB, not around 130 bytes:

```powershell
dir ml-service\model
```

If they're tiny, or the ML service says the model can't be loaded, you cloned before turning on LFS. Fix it from inside the repo:

```powershell
git lfs install
git lfs pull
```

Already cloned before? Update instead of re-cloning:

```powershell
git checkout main
git pull
```

## 3. Add the keys (`.env.local`)

All keys live in **one file at the repo root: `.env.local`**. Git ignores it.

```powershell
copy .env.example .env.local
```

Open `.env.local` and fill in the values the team sent you:

| Variable | What it is | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Public |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key. Safe in the browser, because row-level security protects the data | Public |
| `VITE_ML_API_URL` | `http://localhost:8000` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access. **ML service only** | 🔴 Secret |
| `KEZSPEAK_API_KEY` | Server-to-server key. Generate your own (below) | 🔴 Secret |
| `GEMINI_API_KEY` | Google Gemini key for the tutor AI comparison | 🔴 Secret |
| `KEZSPEAK_ML_URL` | Leave empty | |

Generate your own `KEZSPEAK_API_KEY`:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

> **Rule:** anything starting with `VITE_` is shipped to every visitor's browser. A secret must **never** get a `VITE_` prefix.

> **You need two terminals, both open at the same time.** The web app and the ML service each keep their terminal busy while they run, so there is no prompt left to type the next command. Don't press Ctrl+C in one to free it up, because that stops the server. Open a second terminal instead: in VS Code, click **+** in the terminal panel, or use **Split Terminal**.

## 4. Run the web app (terminal 1)

From the project root (the `kezspeak` folder, not `ml-service`):

```powershell
npm install
npm run dev
```

Open **http://localhost:8443**. The page reloads automatically when you save a file. Leave this terminal running.

## 5. Run the ML service (terminal 2)

Open a **new** terminal for this step and keep terminal 1 running.

**First time only:**

```powershell
cd ml-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m spacy download en_core_web_sm
```

**Every time:**

```powershell
cd ml-service
$env:ENABLE_GRAMMAR="false"; .venv\Scripts\uvicorn app.main:app --port 8000
```

- Wait for `Uvicorn running on http://127.0.0.1:8000`. The first start downloads Whisper, which takes a minute or two.
- **Leave this terminal alone while you use the app.** The service runs only as long as this terminal stays open and you don't press Ctrl+C.
- Check http://localhost:8000/health. It should show `"loaded": true`. If the page doesn't load, the service isn't running.
- The XGBoost warning about "loading a serialized model" is expected and harmless. `Scoring model loaded` on the next line means the model loaded fine.
- When you press Ctrl+C, uvicorn prints a `KeyboardInterrupt` / `CancelledError` traceback. That's a normal shutdown, not a crash.
- If you installed Java and have RAM to spare, leave out `$env:ENABLE_GRAMMAR="false";` to get grammar counts.
- Add `--reload` to restart the service automatically when you edit Python files.

> **macOS/Linux:** use `python3`, and `.venv/bin/` instead of `.venv\Scripts\`. Start the service with `ENABLE_GRAMMAR=false .venv/bin/uvicorn app.main:app --port 8000`.

Keep **both terminals open** while you use the app. To stop everything, press Ctrl+C in each terminal.

## 6. Log in and try it

1. **Become an Administrator** (once; the database role is `super_admin`). After signing up, ask someone with Supabase access to run this in the SQL editor:
   ```sql
   update public.profiles set role = 'super_admin' where email = 'your@email.com';
   ```
2. **Users → Create an account:** make one **Tutor / Teacher** and one **Student**. Untick "Send an invite email" and set a temporary password if email isn't set up yet.
3. **Users → set the student's tutor** (the "Tutor" dropdown on the student's row). Tutors only see their own students.
4. Log in as the **tutor** → **Classwork** → **+ Create assignment**: pick a task, tick the student and set a due date. The student gets a notification.
5. Log in as the **student** → Speaking Activities → the task is under **Assigned to you** → Start → record 30–60 seconds → Submit. Processing takes about 20–30 seconds.
6. Log in as the **tutor** → Submissions (or Classwork → Open recording) to see the transcript, metrics, machine estimate and AI comparison. Add feedback there, then enter a grade in Classwork. Work not turned in by the due date is marked Missing (0).

The shared Supabase project already has every migration applied. For a new project, see the migration list in [SETUP.md §7](SETUP.md#7-database-supabase); the files are shared privately, not on GitHub.

---

## Editing the code

### Where things are

```
kezspeak/
├── src/                          Web app (React + TypeScript)
│   ├── App.tsx                   Routing, login/signup, StudentApp and TutorApp shells
│   ├── index.css                 Tailwind import, global styles, dark-mode color mapping
│   ├── main.tsx                  Entry point (applies the saved theme)
│   ├── components/
│   │   ├── student/              Student pages: dashboard, record, results, assessment path
│   │   ├── tutor/                Tutor pages: dashboard, learners, review, AI comparison
│   │   ├── admin/                Administrator pages: users, tasks
│   │   ├── DashboardLayout.tsx   Shared sidebar and mobile menu
│   │   └── …                     Shared pieces (ProfileCard, ThemeToggle, TaskCatalog, …)
│   ├── hooks/                    useRecorder (microphone), useSubmission (status polling), …
│   └── lib/
│       ├── supabase.ts           Supabase client and Profile type
│       ├── assessments.ts        Queries, uploads, ML service calls
│       ├── admin.ts              Account, task and assignment management
│       ├── progress.ts           Score formatting, learner summaries
│       └── theme.ts              Dark mode
├── ml-service/                   Python FastAPI service
│   ├── app/
│   │   ├── main.py               API routes (process, retry, evaluate, AI comparison)
│   │   ├── admin.py              /admin/users routes (Administrator only)
│   │   ├── auth.py               Checks the user's Supabase login
│   │   ├── db.py                 Database reads and writes
│   │   ├── gemini.py             Gemini comparison
│   │   ├── config.py             Settings read from .env.local
│   │   └── pipeline/             Whisper transcription, acoustic and NLP features, scoring
│   ├── model/                    Trained XGBoost model (Git LFS)
│   ├── tests/                    pytest tests
│   └── scripts/                  score_file.py, evaluate_wer.py
├── supabase/
│   ├── templates/                Invite and password-reset emails
│   ├── functions/server/         Edge Function (not deployed yet)
│   └── migrations/               SQL files. Git-ignored, shared privately
├── .env.example                  Key names (copy to .env.local)
└── SETUP.md                      Longer setup guide
```

### What to edit for common changes

| I want to… | Edit |
|---|---|
| Change a student page | `src/components/student/` |
| Change a tutor page | `src/components/tutor/` |
| Change admin tools | `src/components/admin/` and `src/lib/admin.ts` (+ `ml-service/app/admin.py` for accounts) |
| Change the sidebar or menu | `src/App.tsx` (nav lists) and `src/components/DashboardLayout.tsx` |
| Change colors or dark mode | `src/index.css` |
| Change how a recording is scored | `ml-service/app/pipeline/`. Keep `acoustic.py` identical to the Colab notebook, or the scores will be wrong |
| Swap in a newly trained model | Replace the two `.pkl` files in `ml-service/model/` |
| Change the Gemini comparison | `ml-service/app/gemini.py` and `src/components/tutor/AiComparison.tsx` |
| Change the emails | `supabase/templates/`, then paste the result into Supabase → Authentication → Email Templates |
| Change the database | Write a new SQL migration, share it privately, and run it in the Supabase SQL editor. **Discuss with the team first** |

### Coding conventions

- **New features go in new files** under `src/components/` or `src/lib/`. Don't make `App.tsx` bigger.
- Export React components as **default exports**.
- Use **double quotes** for strings that contain an apostrophe (`"We're here"`). An unescaped `'` breaks the build.
- Use **Tailwind classes** for styling. If you add a new light color class (`bg-*-50`, `text-*-700`, …), add its dark version in the dark-mode block of `src/index.css`.
- Handle **loading and error states** for every Supabase call.
- **Respect roles:** students see only their own data, and tutors see only their assigned learners. The database enforces this too.
- **Wording:** scores are "machine-generated assessment information" that a tutor reviews. Never present them as an official level or grade.

### Git workflow

```powershell
git checkout main
git pull                                # get the latest
git checkout -b feature/short-name      # work on your own branch
# …edit, then test (next section)…
git status                              # .env.local must NOT appear here
git add <files you changed>
git commit -m "Describe the change"
git push -u origin feature/short-name
```

Then open a **Pull Request** into `main` on GitHub so a teammate can review it.

- Never commit `.env.local`, `node_modules/`, `ml-service/.venv/` or anything in `supabase/migrations/`. They're already in `.gitignore`, but check `git status` anyway.
- Use `git add <file>` rather than `git add .`, so nothing unexpected is committed.

---

## Tests and checks

Run these before pushing:

```powershell
# Web app: type check and production build
npx tsc --noEmit
npm run build

# ML service (stop the running service first to save memory)
cd ml-service
$env:ENABLE_GRAMMAR="false"; .venv\Scripts\python -m pytest

# Score one audio file through the full pipeline, with timings
.venv\Scripts\python scripts\score_file.py path\to\clip.webm
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "The KezSpeak server (ml-service) is not reachable" / "The assessment service is not reachable" / Users page won't load | The ML service isn't running. Usually it was stopped with Ctrl+C or its terminal was closed, often to run `npm run dev` in the same terminal. Start it again in its own terminal (step 5) and check http://localhost:8000/health |
| ML service: model can't be loaded / unpickling error | Git LFS wasn't on when you cloned. Run `git lfs install` then `git lfs pull` |
| `mkl_malloc: failed to allocate memory` / `MemoryError` | Out of RAM. Close other apps and use `ENABLE_GRAMMAR=false` |
| `npm run dev` or the build crashes with exit code 134 | Out of memory. Close apps or stop the ML service briefly |
| Recording stuck on "Uploaded" | The ML service was off when you submitted. Start it, open the recording and click **Try again** |
| "Invalid API key" / can't log in | `.env.local` is missing or wrong. Check the `VITE_SUPABASE_*` values and restart `npm run dev` |
| "Supabase's email limit was reached" | Custom SMTP isn't set up (see SETUP.md §8). Create users with a temporary password for now |
| AI comparison: "Gemini is unavailable" | Google is busy or the key is missing. Wait and retry, and check `GEMINI_API_KEY` |
| CORS error calling `localhost:8000` | Your web app runs on a port not listed in `ALLOWED_ORIGINS`. Add it to `.env.local` |
| `Port 8443 is already in use` | Another dev server is running. Close it |
| `python` not found / opens the Microsoft Store / "The file cannot be accessed by the system" | That's the Windows Store placeholder. Reinstall Python 3.11 from python.org with "Add to PATH" ticked, or turn off the `python.exe` entries under Settings → Apps → Advanced app settings → App execution aliases. Once `.venv` exists, the ML service doesn't need plain `python` |
| `cd ml-service` says the path doesn't exist | You're already inside `ml-service`. Check the path shown in the prompt |

More fixes are in [SETUP.md §10](SETUP.md#10-troubleshooting).

## Security rules

- All keys live in `.env.local`, which git ignores. Only `.env.example`, which has no values, is committed.
- The service-role key and the Gemini key stay in the ML service. Never put them in `src/` or behind a `VITE_` prefix.
- If a key leaks, tell the team and rotate it right away: Supabase → Project Settings → API, or Google AI Studio for Gemini.
- Only use model `.pkl` files from the team. Pickle files can run code when they load.
- The SQL migrations are shared privately and are not on GitHub.

## More documentation

- [SETUP.md](SETUP.md): longer setup guide, Supabase dashboard settings (URLs, SMTP, email templates), troubleshooting
- [ml-service/README.md](ml-service/README.md): ML pipeline, API endpoints, model files, differences from the Colab notebook
- [.claude/agents/kezspeak.md](.claude/agents/kezspeak.md): research context, data model and target architecture

## Limitations

Machine scores are experimental. The current model explains almost none of the variance (test R² ≈ 0), so it is a research estimate for tutors to review, not a proficiency rating. The Gemini comparison is a research aid only and never affects scores.

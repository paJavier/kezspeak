# KezSpeak

A web app for assessing ESL speaking. It uses machine learning to support tutors at **Kez Tutorial Service**.

Learners record spoken answers to pre- and post-assessment tasks. The system transcribes each recording and measures acoustic and language features. It then produces a machine-generated pronunciation estimate. A tutor reviews it, adds feedback and can adjust the result. The machine score supports the tutor's judgment and never replaces it.

The core loop is: **Assess → Practice → Improve → Reassess → Measure**.

> Research and capstone project: Mapúa Malayan Colleges Mindanao, College of Computer and Information Science. It is also the IT103L Web Programming course project.

## Features

| Role | What they can do |
|---|---|
| **Student** | Record and submit speaking tasks, follow processing status, view results and tutor feedback, compare pre and post results |
| **Tutor / Teacher** | Review assigned learners' recordings (audio, transcript, features, machine estimate), give feedback, adjust scores, run the research-only Gemini comparison |
| **Admin** | Same view as a tutor, across all learners |
| **Super Admin** | Everything above, plus account management (invite, edit, delete), assignments and tasks |

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

| Part | Folder | Tech |
|---|---|---|
| Web app | `src/` | React 19, Vite 8, TypeScript, Tailwind CSS v4 |
| ML service | `ml-service/` | Python 3.11, FastAPI, faster-whisper, librosa/Parselmouth, spaCy, XGBoost |
| Database and auth | `supabase/` | Supabase Auth, Postgres with row-level security, Storage, email templates |

## Quick start

**Full step-by-step guide:** [SETUP.md](SETUP.md). It covers prerequisites, keys, the database, email settings and troubleshooting.

You need **Node.js 22** and **Python 3.11** (from python.org, with "Add to PATH" ticked).

### 1. Clone and add keys

```powershell
git clone https://github.com/paJavier/kezspeak.git
cd kezspeak
copy .env.example .env.local
```

Fill in `.env.local` with the values a teammate shares with you **privately**. Never commit this file.

### 2. Run the web app (terminal 1)

```powershell
npm install
npm run dev
```

Open **http://localhost:8443**.

### 3. Run the ML service (terminal 2)

First time only:

```powershell
cd ml-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m spacy download en_core_web_sm
```

To start the service:

```powershell
cd ml-service
$env:ENABLE_GRAMMAR="false"; .venv\Scripts\uvicorn app.main:app --port 8000
```

Wait for `Application startup complete.`, then open http://localhost:8000/health. It should report `"loaded": true`.

The first start downloads the Whisper model, about 500 MB. Both terminals must stay open while you use the app.

> macOS/Linux: use `python3` and `.venv/bin/` instead of `.venv\Scripts\`, and run `ENABLE_GRAMMAR=false .venv/bin/uvicorn app.main:app --port 8000`.

### 4. Log in

A super admin creates accounts under **Users** and links students to tutors under **Assignments**. To make the first super admin, open the Supabase SQL editor and run:

```sql
update public.profiles set role = 'super_admin' where email = 'your@email.com';
```

## Tests and checks

```powershell
# ML service (stop the running service first to save memory)
cd ml-service
$env:ENABLE_GRAMMAR="false"; .venv\Scripts\python -m pytest

# Web app
npx tsc --noEmit
npm run build
```

## Security

- All keys live in `.env.local`, which git ignores. Only `.env.example`, which has no values, is committed.
- Anything prefixed `VITE_` ships to the browser. The service-role key and the Gemini key must never get that prefix.
- The SQL migrations are shared privately within the team and are not in this repository. The shared Supabase project already has them applied.

## More documentation

- [SETUP.md](SETUP.md): full setup guide and troubleshooting
- [ml-service/README.md](ml-service/README.md): ML pipeline, endpoints, model files and differences from the notebook
- [.claude/agents/kezspeak.md](.claude/agents/kezspeak.md): research context, data model and architecture

## Limitations

Machine scores are experimental. The current model explains almost none of the variance (test R² ≈ 0), so it is a research estimate for tutors to review, not a proficiency rating. The Gemini comparison is a research aid only and never affects scores.

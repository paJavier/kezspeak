---
name: kezspeak
description: Project expert for KezSpeak, the ESL speaking-assessment web app (React + Vite + Supabase) built from the KezSpeak research paper and system-architecture draft. Use for any feature, design, schema, or planning work on this repo, or when a question depends on the research goals, ML pipeline, user roles, or data model.
---

You are the development agent for **KezSpeak**. You know both the research the app is based on and the current state of the code. Before you change anything, check the code against the facts below. The repository is the source of truth for what exists now. The documents describe the target design.

# 1. What KezSpeak is

KezSpeak is a web-based, **multimodal machine-learning** system that assesses English speaking performance of ESL learners through **pre-assessment and post-assessment** of recorded speaking responses. It is a research/capstone project by Psyryll Andre Javier and Philip Andrew Luminarias (Mapúa Malayan Colleges Mindanao, College of Computer and Information Science, Davao City). It is also the IT103L Web Programming course project.

- **Client:** Kez Tutorial Service, a 100% online English tutoring business run by Laurens Nobels. It serves about 14 learners (children, adolescents and adults), mainly from China, Taiwan, Japan and Korea. Live classes stay on ClassIn. KezSpeak does not replace ClassIn.
- **It is not an LMS.** The core loop is **Assess → Practice → Improve → Reassess → Measure**.
- **Tutor-in-the-loop:** machine scores *support* tutors and never replace them. Tutors review the generated results, add qualitative feedback and can adjust the final evaluation. Feedback is shown as supportive information. Never present unvalidated claims (CEFR level, proficiency labels) as fact.
- **Asynchronous:** learners record and submit, and processing happens afterwards. Real-time assessment and video conferencing are out of scope.
- **Scope:** advanced NLP analysis targets adult learners. Younger learners use milestone-based progress tracking and are out of scope for advanced NLP.
- The project does not build new STT or NLP models. It uses existing ones (Whisper, spaCy, LanguageTool and similar).

## Objectives
1. Build a web-based speaking assessment system for ESL learners and tutors.
2. Implement multimodal speech and language processing (acoustic and linguistic features) that produces speaking scores.
3. Evaluate Random Forest and XGBoost with suitable metrics.
4. Compare pre- and post-assessment results to measure improvement and support tutor evaluation.

## Research questions and targets
- STT Word Error Rate: target **WER ≤ 15%**. WER = (S + D + I) / reference words × 100.
- How well acoustic and linguistic features are extracted.
- Model accuracy on the combined features: **MAE, RMSE, R²**.
- The measurable pre/post difference.
- How closely machine scores agree with tutor evaluations.

# 2. Users and use cases

| Role | Can do |
|---|---|
| **Learner** (`student` in code) | Register and log in, take a pre- or post-assessment, record and re-record audio and submit it, view results and feedback, track progress and the pre/post comparison, open learning materials |
| **Tutor** | Manage learner profiles, create and assign standardized pre/post tasks, manage schedules, view submissions (audio, transcript and ML result), review results, give qualitative feedback and adjust scores, compare pre/post |
| **Administrator** | Manage user accounts and roles, assessment tasks, the resource library, master schedules, packages and payments, system settings and reports |

Planned role-based access:
- Learners see only their own records.
- Tutors see only their assigned or authorized learners.
- Admins have broad access.
- These rules are enforced on the backend and through Supabase RLS, not only in the UI.

Key workflows:
- **Learner:** Dashboard → Speaking Assessment → Record Response → Submit → View Results
- **Tutor:** Dashboard → Select Learner → View Submission → Review Result → Provide Feedback
- **Admin:** separate management interface for users, tasks, reports and settings.

# 3. Domain model (UML class diagram and architecture draft)

`User` (id, name, email, auth reference, role) is the base of `Learner` (English level, learning group, learning goal), `Tutor` (availability, assigned learners) and `Administrator`. The other entities are:
- `AssessmentTask` / Speaking Task: id, title, prompt/instructions, description, assessment type, **pre | post**, assigned learner, tutor, schedule, status.
- `Submission` / Audio Submission: id, learner, task, audio file reference, submitted date, **processing status**.
- `AudioRecording`: file path, format, size, duration. The file lives in object storage. Only metadata goes in the database.
- `Transcript`: the STT output linked to the submission.
- `MLAnalysis`: the extracted features and the processing record.
- `AssessmentResult` / Evaluation Result: id, submission, transcript, feature-based scores (speaking rate, lexical diversity, grammar accuracy, and so on), overall score, assessment type, **model version**, feature version, timestamp.
- `Feedback`: tutor comments and score adjustments.
- `LearningMaterial`, `SystemSettings`. Later: schedules, packages and payments.

**Processing statuses:** Pending, Uploading, Processing, Transcribing, Extracting Features, Evaluating, Completed, Failed. If processing fails, keep the audio so the job can be retried without asking the learner to record again.

**Traceability:** every result must link to its learner, task, submission and model version (for example `kezspeak-xgb-v1`, `features-v1`).

# 4. ML pipeline (developed offline in Google Colab)

Audio (16 kHz, mono) → **Whisper (small)** STT → features → model → score from 0 to 100.

- **40 acoustic features** (Librosa/Parselmouth): duration 1, speech/silence 2, pause measures 3, speech rate 1 (WPM = words / seconds × 60), RMS energy 3, pitch 4, and 13 MFCCs as mean + std = 26.
- **8 NLP features** (spaCy/LanguageTool): word count, unique words, TTR, MATTR, grammar errors, sentence count, average sentence length, average dependency depth.
- **Target:** pronunciation score = 100 × (1 − (subs + adds + dels) / canonical phonemes), clamped to 0–100, taken from the **L2-ARCTIC** annotations. This is a development target only. It is not a tutor score.
- **Data split:** 1,800 train / 899 validation / 900 test. L2-ARCTIC is used only to develop the model. Real pre/post data will come from Kez learners.
- **Models:** Random Forest is the baseline. **XGBoost** is the proposed primary model (500 estimators, learning rate 0.03, max depth 5, min child weight 3, subsample 0.8, colsample 0.8, L1/L2 regularization). The final choice is made from the empirical results.
- **Preliminary results (MAE / RMSE / R²):**
  - RF acoustic: 7.04 / 8.65 / 0.007
  - XGB acoustic: 6.89 / 8.54 / 0.017
  - XGB NLP: 7.15 / 8.92 / 0.072
  - XGB combined: 6.92 / 8.57 / 0.010

  R² is very low in every configuration, so the model explains almost none of the variance yet. Never present these scores as reliable.
- **What the Colab notebook actually deployed** (`SoftEng_Pre_Processing.ipynb`): an **audio-only** XGBoost (`kezspeak_production_xgboost.pkl` + `kezspeak_production_features.pkl`, 40 features, trained on train+val, test MAE 6.95 / RMSE 8.72 / R² −0.02). The notebook's final NLP set has **15** features (it adds 7 POS counts). NLP features are stored and shown to tutors but do **not** feed the score. Training and inference must use the same preprocessing; `ml-service/app/pipeline/acoustic.py` is the port, so keep it in lockstep with the notebook.
- **Pre/post metrics:**
  - Score change = post − pre
  - Improvement % = (post − pre) / pre × 100
  - Average change across learners
  - Also compare speech rate, pause measures and NLP features per dimension.

**Performance targets:**
- Recording starts in ≤ 2 s.
- Upload of a 3-minute recording takes ≤ 15 s.
- STT takes ≤ 30 s.
- Feature extraction takes ≤ 20 s.
- End to end takes about 60 s or less.

# 5. Target architecture vs. what this repo actually is

The architecture draft proposes three tiers:
- **Next.js** + React + TS + Tailwind (+ Recharts) on Vercel
- A **Python FastAPI** backend on Render or Railway, running the AI processing service (Whisper, Librosa/Parselmouth, spaCy/LanguageTool, XGBoost)
- **Supabase** Postgres + Auth + Storage (or S3)
- HTTPS, secrets kept in environment variables, and RLS

**The current repo is different. Do not assume the planned stack exists:**
- The frontend is **React 19 + Vite 8 + TypeScript + Tailwind v4**, running in **Figma Make**, not Next.js. A dev server is already running, so don't start one. Follow `AGENTS.md`: default exports, double quotes for strings that contain apostrophes, and global CSS in `src/index.css`.
- Almost all UI is in **`src/App.tsx`** (about 2,270 lines):
  - `Landing`, `Login`, `Signup`, `StudentApp`, `TutorApp` and `App`
  - Role routing comes from the Supabase `profiles` table (`id, full_name, email, role: student|tutor|admin, avatar_url`).
  - The **admin role currently renders `TutorApp`**. There is no admin UI yet.
- The Supabase client is `src/lib/supabase.ts`. It reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment only (no hard-coded fallback).
- **All keys live in the repo-root `.env.local`** (gitignored); `.env.example` lists the names with no values. The frontend and `ml-service` both read it. Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `KEZSPEAK_API_KEY`, `KEZSPEAK_ML_URL`) must never get a `VITE_` prefix. Never write a key into a source file; `utils/supabase/info.tsx` is Figma Make–generated and now reads env vars, so if Figma Make regenerates it with literal values, strip them again.
- **No mock data remains in the dashboards** (removed so the app can be filled with real users). Every student/tutor page reads Supabase; empty states show when there is no data. Shared shell: `components/DashboardLayout.tsx` (sidebar + mobile drawer). Data helpers: `hooks/useSubmissionList.ts`, `lib/progress.ts` (journey stage, per-learner summaries, needs-review). Pages: `student/StudentDashboard`, `student/AssessmentPath`, `TaskCatalog`, `ProfileCard`, `tutor/TutorDashboard`, `tutor/LearnerOverview`, `tutor/LearnerProgress`. Real parts:
  - `src/lib/assessments.ts`: typed queries, upload, ML calls, pre/post comparison.
  - `src/hooks/useRecorder.ts` (MediaRecorder) and `src/hooks/useSubmission.ts` (status polling).
  - `src/components/student/RecordActivity.tsx` (student `activity` page), `student/AssessmentResults.tsx` (`results`/`progress`/`feedback` pages), `tutor/SubmissionReview.tsx` (tutor `submissions`/`review` pages), plus shared `EvaluationSummary`, `ProcessingStatus`, `AudioPlayer`, `icons`.
- **Database:** `supabase/migrations/20261023_assessment_pipeline.sql` adds `assessment_tasks`, `assignments` (links tutor ↔ learner, drives tutor RLS), `submissions`, `evaluations`, `tutor_feedback`, and the private `recordings` storage bucket at `{learner_id}/{submission_id}.webm`. Helpers: `kez_role()`, `kez_tutor_has_learner()`.
- **`ml-service/`** is a Python 3.11 FastAPI service (approved departure from the Vite-only stack; see its README).
  - Browser → `POST /submissions/{id}/process` and `/retry` with the user's Supabase JWT. The service uses the service-role key to update status and write `evaluations`.
  - Server-to-server → `POST /evaluate` (multipart `file`) with header `access_token: KEZSPEAK_API_KEY`. Fails closed (503) when the key is unset. The key must never be in `VITE_*` vars.
  - Run: `cd ml-service; .venv\Scripts\uvicorn app.main:app --port 8000`. Tests: `.venv\Scripts\python -m pytest`.
- **AI fallback (Gemini), decided by the user:** when the model can't score a recording (status `failed`, or stalled for more than 3 minutes), the learner can opt in, after a consent checkbox, to Gemini **text feedback with no score**. It's stored in the separate `ai_feedback` table (migration `20261024_ai_feedback.sql`), shown in a violet "AI-generated, not part of your assessment" card, and **must never feed `evaluations`, scores or pre/post comparisons**. Code: Edge Function route `/make-server-8450f8e5/ai-feedback` + `gemini_feedback.tsx` (secret `GEMINI_API_KEY`), and `AiFeedbackCard` / `ProcessingStatus` in the frontend. `supabase/config.toml` maps the function name `make-server-8450f8e5` to `functions/server/index.tsx` for CLI deploys.
- **Super admin** (migration `20261026_super_admin.sql`): role `super_admin` (UI labels: Student, Tutor / Teacher, Moderator (`admin`, formerly labeled Staff), Administrator (`super_admin`), set in `lib/admin.ts` `roleLabels`, `ProfileCard` and ml-service `ROLE_LABELS`; `tutor` is the DB value for lecturers/teachers; only the labels changed, never rename the DB values). `kez_role()` reports super_admin as `admin` so every admin RLS policy applies; trigger `profiles_guard_role` blocks signed-in users from changing roles and forces public sign-ups to `student`. Account CRUD goes through ml-service `/admin/users` (service role, `app/admin.py`, super_admin only; can't delete or demote yourself). Tasks and assignments CRUD go straight to Supabase under RLS. UI: `src/components/admin/` (Users, Assignments, Tasks pages in `TutorApp`, shown only to super_admin). Bootstrap the first one with SQL. **Onboarding:** creating a user without a password sends a Supabase invite (`invite_user_by_email`); `POST /admin/users/{id}/password-email` sends a reset link (also "resend invite"). Redirects are limited to `ALLOWED_ORIGINS`. Links land on `SetPasswordScreen` (detected from the URL hash `type=invite|recovery` in `lib/supabase.ts` before the client consumes it). Users change their own password under Profile (`ChangePasswordForm`); login has a working "Forgot password?". Real delivery needs custom SMTP in the Supabase dashboard (built-in mail only reaches project team members and is heavily rate-limited) and the app URL in Auth → URL Configuration.
- **Classwork** (migrations `20261028_classwork.sql`, `20261030_simplify.sql`; `lib/classroom.ts`): each student has one tutor, set by a super admin on the Users page (Tutor dropdown → RPC `kez_set_learner_tutor`, which also moves the student's assignments). It's stored in `tutor_learners`; `kez_tutor_has_learner()` reads it, and tutors can only create assignments for their own students. There is no separate Rosters page. Tutors/admins assign tasks with a due date and grade turned-in work under "Classwork" (`tutor/Classwork.tsx`: "+ Create assignment" modal, collapsible cards, setup checklist when empty); an assignment's `tutor_id` is the student's tutor, or the assigning admin when there is none; learners see "Assigned to you" above Speaking Activities (`student/MyAssignments.tsx`). A trigger links each new submission to the open assignment and refuses it after the deadline; `kez_mark_missing_assignments()` (called when classwork loads) sets overdue unsubmitted work to `missing`, grade 0. `assignments.grade` is a class grade, separate from the machine score, and never feeds evaluations or pre/post.
- **Frontend tests:** `npm test` (Vitest 5, pinned). Unit tests live next to the code (`src/lib/*.test.ts`) with builders in `src/test/fixtures.ts`; they mock `./supabase`, so they never touch the network. Covered: classwork states/grades, learner summaries, pre/post (first pre = baseline).
- **Migrations are private by team decision:** `supabase/migrations/` is git-ignored and shared outside GitHub. SETUP.md §7 lists every file in run order. Notifications SQL lives there as `20261027b_notifications.sql`. Research guards (`20261101_research_guards.sql`): pre/post recordings need an open assignment, tutors only change their own practice tasks, pre/post assigned once per learner, practice re-assignable once the open copy is closed.
- **Navigation:** tutor/admin sidebar = Dashboard, Classwork, Submissions (page `review`), Learners (opens `progress` per learner), Tasks, Statistics, Users (super admin), Notifications, Profile. Student sidebar = Dashboard, My Assessment, Speaking Activities, Results (feedback + pre/post), Notifications, Profile. Old page ids (`submissions`, `feedback`, `progress`, `activities`, `assignments`) are kept as aliases in `App.tsx` (`tutorAliases`, `studentAliases`) so notification links keep working.
- **Statistics** (tutor nav "Statistics", page id `reports`, `tutor/Statistics.tsx`): KPI tiles, weekly new learners / recordings, processing and classwork breakdowns, recent sign-ups (admins). Admins see the whole app, tutors their roster. Sign-up dates come from `kez_list_people().created_at` (migration `20261029_statistics.sql`). Chart colors are the `--viz-*` tokens in `index.css`. Per-learner pre/post stays on Progress.
- **AI comparison** (migration `20261025_ai_comparisons.sql`): tutor/admin-only research aid. `POST /submissions/{id}/ai-comparison` in ml-service (`app/gemini.py`, `GEMINI_API_KEY`) asks Gemini for pronunciation accuracy 0-100 (same quantity as the model) plus notes; stored once per recording in `ai_comparisons`, unreadable by learners, never feeds scores or pre/post. UI: `tutor/AiComparison.tsx` in the review page.
- **Announcements** (migration `20261102_announcement_audience.sql`, `notifications/AnnouncementsPage.tsx`, `lib/notifications.ts` `audienceOptions`): Blackboard-style. Administrator/Moderator pick `audience` everyone | students | tutors; tutors may post but `notify_published_announcement()` delivers only to their `tutor_learners` students (RLS forces tutor audience = students). Recipients of any role get read tracking via `announcement_recipients`.
- **Tutor required** (migration `20261103_require_tutor.sql`): a student sees no tasks (except ones already recorded, for results), no classwork and cannot record until a super admin sets their tutor (`tutor_learners`); admins can no longer assign work to tutor-less students. UI: `student/AwaitingTutor.tsx` replaces My Assessment / Speaking Activities and tops the dashboard (`fetchMyTutorId` in `lib/classroom.ts`); Classwork disables tutor-less students. Staff notification filters are All / Unread / Announcements / Submissions (`notificationFilters` in `lib/notifications.ts`).
- **Exam-aligned assessment** (migration `20261104_exam_goals.sql`, `lib/exams.ts` is the single source of truth): IELTS Speaking (4 criteria, bands 0-9, overall = mean rounded to the nearest half band), TOEFL iBT-style (Delivery / Language Use / Topic Development, 0-4) and Cambridge-style (Grammar & Vocabulary / Discourse Management / Pronunciation, 0-5; Interactive Communication left out because recordings are solo). Each learner has a goal in `learner_goals` (exam, Cambridge level, target, exam date; learner, their tutor and admins can edit; `lib/goals.ts`, `ExamGoalCard`). **Tutors score the rubric** in `tutor/RubricPanel.tsx` (stored in `tutor_feedback.rubric` jsonb; required for pre/post when the learner has a goal); machine features appear only as evidence chips (`evidenceFor`). Rubric scores are labelled "practice estimate by your tutor, not an official score", carry the trademark line, and never feed `evaluations`, the 0-100 score or research pre/post. `ExamProgress` (Results + LearnerProgress) compares the same pre/post pair as `comparePrePost`; `ProgressReport` prints via `window.print()` with `@media print` rules in `index.css`. Exam-style templates (`EXAM_TEMPLATES`, original prompts) set `assessment_tasks.exam_style` / `prep_seconds`; `RecordActivity` shows a preparation countdown; Draft with AI passes `exam_style` (`EXAM_STYLE_HINTS` in ml-service `gemini.py`). TOEFL iBT changed its format in Jan 2026: re-check ETS descriptors before launch.
- **AI activity drafts**: Tasks page "Draft with AI" (`admin/TaskManagement.tsx` `AiDraftPanel`) uploads a PDF/DOCX/TXT (≤ 10 MB) to ml-service `POST /activities/generate` (staff only; `app/reference.py` reads the file in memory, `gemini.generate_activity`). Nothing is stored; the tutor copies the editable draft into the task form (follow-up questions are folded into `prompt` via `lib/admin.ts` `draftPrompt`) and saves normally.
- **Deployment:** `DEPLOYMENT.md` (Vercel + Render + Supabase checklist); `vercel.json` holds the SPA rewrite needed for `/reset-password`.
- `supabase/functions/server/` (Deno + Hono) has `/health`, `/make-server-8450f8e5/evaluate` and `/make-server-8450f8e5/ai-feedback`. The second checks the caller is a tutor/admin, then forwards to the ML service via `kezspeak_ml.tsx` using the `KEZSPEAK_ML_URL` and `KEZSPEAK_API_KEY` secrets.
- The UI specs used to generate the screens are in `src/imports/pasted_text/` (student interface, tutor interface, auth integration, auth-flow fix). Read the relevant one before changing a screen.

When you implement something from the target design, pick the smallest step that fits the current stack. Moving the frontend to Next.js is still a departure; confirm it first.

# 6. Working rules

- Read the relevant part of `src/App.tsx` and `src/lib/` before editing. When you add a feature, extract it into a new file instead of making `App.tsx` bigger.
- Reuse the existing `supabase` client and the `Profile` type. Handle loading and error states for every Supabase call.
- Respect role-based access in both the UI and the queries.
- **Dark mode:** `html.dark` (set by `lib/theme.ts`, toggled by `components/ThemeToggle.tsx`, saved in localStorage, defaults to the device setting). Existing light utility classes are remapped in the dark-mode block of `src/index.css`. If you introduce a new light color class (`bg-*-50`, `text-*-700`, etc.), add its dark mapping there or use a `dark:` variant.
- Never print, commit or hard-code secrets. Only the anon key belongs on the client. `.env*` is gitignored.
- Explain any Supabase schema or RLS change before you make it.
- Keep changes small and preserve existing comments.
- Wording in the UI and the docs must keep the tutor-in-the-loop framing. Scores are "machine-generated assessment information" that a tutor reviews.
- When you finish, summarize what changed and what to test.

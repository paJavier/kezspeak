# KezSpeak ML service

> New to the project? Start with the full team setup guide in [`../SETUP.md`](../SETUP.md).

FastAPI service that turns a learner's recording into machine-generated assessment information:

**audio → Whisper "small" transcript → 40 acoustic + 15 NLP features → XGBoost pronunciation estimate (0–100)**

The feature code is a line-for-line port of `SoftEng_Pre_Processing.ipynb` (cells 87–89, 156). The deployed model is the notebook's **audio-only** production XGBoost (`kezspeak_production_xgboost.pkl`, 40 features, test R² ≈ −0.02). Treat the score as an experimental estimate that a tutor reviews. The NLP features are stored and shown, but they don't affect the score.

## Setup (Windows)

```powershell
cd ml-service
& "C:\Program Files\Python311\python.exe" -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m spacy download en_core_web_sm
```

All keys live in the repo-root **`.env.local`** (gitignored), which the frontend and this service share. `.env.example` at the root lists every variable. Server-only keys (`SUPABASE_SERVICE_ROLE_KEY`, `KEZSPEAK_API_KEY`) have no `VITE_` prefix, so Vite never bundles them. On a deployment host, set the same names as real environment variables instead.

Java is required for grammar counts (LanguageTool, about 250 MB downloaded on first start). Set `ENABLE_GRAMMAR=false` to skip them.

### Model files (from Google Drive → `MyDrive/KezSpeak/results/`)

Copy these into `ml-service/model/`:

- `kezspeak_production_xgboost.pkl`
- `kezspeak_production_features.pkl` (the service checks that its feature order matches `acoustic.py`)

A pickle loads reliably only with the XGBoost version that trained it. If loading fails, add this cell in Colab and copy the `.json` file instead. The service prefers `.json` when both exist:

```python
production_model.save_model(f"{DRIVE_RESULTS}/kezspeak_production_xgboost.json")
```

### Database

Run the files in `../supabase/migrations/` in date order in the Supabase SQL editor (see `SETUP.md`; the shared team project already has all of them, and the SQL files are shared privately rather than committed). The first one creates the tasks, assignments, submissions, evaluations and tutor_feedback tables, the row-level security rules, and the private `recordings` bucket.

A tutor only sees a learner's recordings after an assignment links them:

```sql
insert into assignments (task_id, learner_id, tutor_id)
select t.id, '<learner uuid>', '<tutor uuid>' from assessment_tasks t;
```

## Run

```powershell
.venv\Scripts\uvicorn app.main:app --port 8000
```

On a laptop with 8 GB of RAM or less, skip the grammar checker (Java, about 0.6 GB):

```powershell
$env:ENABLE_GRAMMAR="false"; .venv\Scripts\uvicorn app.main:app --port 8000
```

The frontend reads `VITE_ML_API_URL` (default `http://localhost:8000`). Add the frontend's origin to `ALLOWED_ORIGINS`.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Status and whether the model is loaded |
| POST | `/submissions/{id}/process` | user's Supabase session (`Authorization: Bearer`) | Start analysis of an uploaded submission; returns 202, then status updates go to the `submissions` row |
| POST | `/submissions/{id}/retry` | same | Re-run a `failed` submission without re-recording |
| POST | `/evaluate` | `access_token: <KEZSPEAK_API_KEY>` | **Server-to-server only.** Multipart `file` field; returns the result directly and stores nothing |
| POST | `/activities/generate` | user's Supabase session (tutor/admin) | Multipart `file` (PDF, DOCX or TXT, ≤ 10 MB) plus optional `skill_focus`; Gemini drafts a speaking task (title, prompt, follow-up questions, skill focus, duration). The file and draft are not stored. Needs `GEMINI_API_KEY` (503 when unset) |

`KEZSPEAK_API_KEY` must never be put in the frontend, because anything prefixed `VITE_` is shipped to every browser. The Supabase Edge Function route `/make-server-8450f8e5/evaluate` holds the key and only accepts tutors and admins. Give the Edge Function these secrets:

```
supabase secrets set KEZSPEAK_ML_URL=https://<public ml-service url> KEZSPEAK_API_KEY=<same key>
```

An Edge Function runs in Supabase's cloud, so it can't reach `localhost`. The ML service needs a public URL first (deployment, or a tunnel while testing).

## Tools

```powershell
.venv\Scripts\python -m pytest                                   # unit, API and parity tests
.venv\Scripts\python scripts\score_file.py clip.webm             # full pipeline on one file, with timings
.venv\Scripts\python scripts\evaluate_wer.py data\wer_set --csv wer.csv   # research question 1, target <= 15%
```

**Parity test:** in Colab run `sf.write("ABA_arctic_a0003.wav", ds["train"][0]["audio"]["array"], 16000)` and copy the file to `tests/fixtures/`. The test then checks this service's features against the values your notebook printed. For a stronger check, add `tests/fixtures/parity.csv` (a few rows of `kezspeak_l2_arctic_test_features.csv`) plus `{speaker_id}_{utterance_id}.wav` files for those rows.

## Known differences from the notebook

- **Whisper runtime:** faster-whisper (CTranslate2) instead of openai-whisper. It uses the same "small" weights with greedy decoding and is several times faster on CPU. Only `speech_rate` depends on the transcript.
- **Word count for speech rate:** this service uses the training definition (regex `[a-zA-Z]+`). The notebook's later `evaluate_production_audio` helper used `transcript.split()`, which does not match the training data.
- **Grammar check failures:** if a grammar check fails, `grammar_errors` is `null` (the notebook stored `0`). The UI then shows "n/a" instead of claiming zero errors.
- **LanguageTool version:** may differ from Colab (6.4 here vs 6.8). Grammar counts are for display only.

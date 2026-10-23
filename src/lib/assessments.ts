import { supabase } from "./supabase"

const ML_API_URL = (import.meta.env.VITE_ML_API_URL || "http://localhost:8000").replace(/\/+$/, "")
const RECORDINGS_BUCKET = "recordings"

export type TaskKind = "pre" | "post" | "practice"

export type SubmissionStatus =
  | "pending"
  | "processing"
  | "transcribing"
  | "extracting_features"
  | "evaluating"
  | "completed"
  | "failed"

export type AssessmentTask = {
  id: string
  title: string
  prompt: string
  skill_focus: string | null
  kind: TaskKind
  duration_seconds: number
}

export type AcousticFeatures = Record<string, number> & {
  duration: number
  speech_rate: number
  pause_count: number
  avg_pause: number
  max_pause: number
  speech_duration: number
}

export type NlpFeatures = {
  word_count: number
  unique_words: number
  ttr: number
  mattr: number
  sentence_count: number
  avg_sentence_length: number
  avg_dependency_depth: number
  grammar_errors: number | null
}

export type Evaluation = {
  id: string
  transcript: string
  acoustic_features: AcousticFeatures
  nlp_features: NlpFeatures
  predicted_score: number
  model_version: string
  feature_version: string
  processing_ms: number | null
  created_at: string
}

export type TutorFeedback = {
  id: string
  tutor_id: string
  comment: string
  strengths: string | null
  improvements: string | null
  adjusted_score: number | null
  updated_at: string
}

/** Gemini fallback feedback: text only, never a score, never part of pre/post. */
export type AiFeedback = {
  id: string
  provider: string
  model: string
  transcript: string | null
  summary: string
  strengths: string[]
  improvements: string[]
  created_at: string
}

export type Submission = {
  id: string
  learner_id: string
  task_id: string
  audio_path: string
  mime_type: string
  duration_seconds: number | null
  status: SubmissionStatus
  error: string | null
  submitted_at: string
  updated_at: string
  task: AssessmentTask | null
  evaluation: Evaluation | null
  feedback: TutorFeedback | null
  ai_feedback: AiFeedback | null
  learner_name: string | null
}

export const statusLabels: Record<SubmissionStatus, string> = {
  pending: "Uploaded",
  processing: "Starting analysis",
  transcribing: "Transcribing your speech",
  extracting_features: "Measuring fluency and language",
  evaluating: "Scoring",
  completed: "Ready",
  failed: "Failed",
}

export const isProcessing = (status: SubmissionStatus) =>
  status !== "completed" && status !== "failed"

// The pipeline normally finishes in about a minute; after this long with no
// status change, treat the job as stalled (e.g. the ML service is down).
const STALLED_AFTER_MS = 3 * 60 * 1000

export const isStalled = (submission: Submission) =>
  isProcessing(submission.status) && Date.now() - new Date(submission.updated_at).getTime() > STALLED_AFTER_MS

// PostgREST returns one-to-one embeds as an object, but older relationships
// can come back as a single-item array.
const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null)

const BASE_SELECT =
  "*, task:assessment_tasks(*), evaluation:evaluations(*), feedback:tutor_feedback(*), learner:profiles(full_name)"
const WITH_AI_SELECT = `${BASE_SELECT}, ai_feedback:ai_feedback(*)`

type SubmissionRow = Omit<Submission, "task" | "evaluation" | "feedback" | "ai_feedback" | "learner_name"> & {
  task: AssessmentTask | AssessmentTask[] | null
  evaluation: Evaluation | Evaluation[] | null
  feedback: TutorFeedback | TutorFeedback[] | null
  ai_feedback?: AiFeedback | AiFeedback[] | null
  learner: { full_name: string } | { full_name: string }[] | null
}

const toSubmission = ({ task, evaluation, feedback, ai_feedback, learner, ...row }: SubmissionRow): Submission => ({
  ...row,
  task: one(task),
  evaluation: one(evaluation),
  feedback: one(feedback),
  ai_feedback: one(ai_feedback),
  learner_name: one(learner)?.full_name ?? null,
})

// Until migration 20261024_ai_feedback.sql is applied the ai_feedback
// relationship doesn't exist; fall back to the base query so pages keep working.
let aiFeedbackAvailable = true

async function selectSubmissions<T>(
  run: (select: string) => PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>,
) {
  if (aiFeedbackAvailable) {
    const result = await run(WITH_AI_SELECT)
    if (!result.error || !/ai_feedback/.test(result.error.message)) return result
    aiFeedbackAvailable = false
  }
  return run(BASE_SELECT)
}

export async function listTasks(): Promise<AssessmentTask[]> {
  const { data, error } = await supabase
    .from("assessment_tasks")
    .select("id, title, prompt, skill_focus, kind, duration_seconds")
    .order("created_at")
  if (error) throw new Error(`Could not load speaking tasks: ${error.message}`)
  return data ?? []
}

export async function getSubmission(id: string): Promise<Submission> {
  const { data, error } = await selectSubmissions((select) =>
    supabase.from("submissions").select(select).eq("id", id).single(),
  )
  if (error) throw new Error(`Could not load the submission: ${error.message}`)
  return toSubmission(data as unknown as SubmissionRow)
}

/** Learners see their own submissions; tutors see their assigned learners' (RLS). */
export async function listSubmissions(learnerId?: string): Promise<Submission[]> {
  const { data, error } = await selectSubmissions((select) => {
    const query = supabase.from("submissions").select(select).order("submitted_at", { ascending: false })
    return learnerId ? query.eq("learner_id", learnerId) : query
  })
  if (error) throw new Error(`Could not load submissions: ${error.message}`)
  return (data as unknown as SubmissionRow[]).map(toSubmission)
}

/**
 * Ask Gemini (via the Edge Function) for text feedback on a recording the ML
 * pipeline couldn't score. The UI must show the data-sharing notice first.
 */
export async function requestAiFeedback(submissionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("make-server-8450f8e5/ai-feedback", {
    body: { submission_id: submissionId },
  })
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? "AI feedback is unavailable right now. Please try again later.")
  }
}

/**
 * Research comparison (tutors/admins only, enforced by RLS and ml-service):
 * the trained model's score next to a Gemini estimate. Never feeds final
 * scores or pre/post.
 */
export type AiComparison = {
  id: string
  submission_id: string
  provider: string
  model: string
  ai_score: number | null
  model_score: number | null
  model_version: string | null
  transcript: string | null
  summary: string
  strengths: string[]
  improvements: string[]
  created_at: string
}

export async function getAiComparison(submissionId: string): Promise<AiComparison | null> {
  const { data, error } = await supabase
    .from("ai_comparisons")
    .select("*")
    .eq("submission_id", submissionId)
    .maybeSingle()
  if (error) {
    if (/ai_comparisons/.test(error.message)) {
      throw new Error("AI comparison isn't set up yet: run migration 20261025_ai_comparisons.sql in Supabase.")
    }
    throw new Error(`Could not load the AI comparison: ${error.message}`)
  }
  return data as AiComparison | null
}

export const requestAiComparison = (submissionId: string) =>
  callMlService<AiComparison>(`/submissions/${submissionId}/ai-comparison`)

/** Authenticated call to ml-service with the user's Supabase session. */
export async function callMlService<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; unreachable?: string } = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Your session has expired. Please log in again.")

  let response: Response
  try {
    response = await fetch(`${ML_API_URL}${path}`, {
      method: options.method ?? "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new Error(
      options.unreachable ??
        "The assessment service is not reachable. Your recording is saved and can be processed later.",
    )
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    // FastAPI validation errors arrive as a list of {msg} objects.
    const detail = Array.isArray(body?.detail)
      ? body.detail.map((d: { msg: string }) => d.msg).join("; ")
      : body?.detail
    throw new Error(detail ?? `The assessment service returned ${response.status}.`)
  }
  return (await response.json().catch(() => null)) as T
}

export const requestProcessing = async (submissionId: string) => {
  await callMlService(`/submissions/${submissionId}/process`)
}

export const retryProcessing = async (submissionId: string) => {
  await callMlService(`/submissions/${submissionId}/retry`)
}

const extensionFor = (mimeType: string) =>
  mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm"

/**
 * Upload the recording, create the submission row, then ask the ML service to
 * process it. If the service is down, the submission stays `pending` and the
 * returned `processingError` explains why; the audio is not lost.
 */
export async function submitRecording(params: {
  learnerId: string
  task: AssessmentTask
  audio: Blob
  durationSeconds: number
}): Promise<{ submissionId: string; processingError: string | null }> {
  const mimeType = params.audio.type.split(";")[0] || "audio/webm"
  const submissionId = crypto.randomUUID()
  const audioPath = `${params.learnerId}/${submissionId}.${extensionFor(mimeType)}`

  const upload = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .upload(audioPath, params.audio, { contentType: mimeType, upsert: false })
  if (upload.error) throw new Error(`Could not upload your recording: ${upload.error.message}`)

  const { error } = await supabase.from("submissions").insert({
    id: submissionId,
    task_id: params.task.id,
    learner_id: params.learnerId,
    audio_path: audioPath,
    mime_type: mimeType,
    duration_seconds: Math.round(params.durationSeconds * 100) / 100,
  })
  if (error) {
    // submissions.learner_id references profiles(id): the account has no profile row.
    if (error.code === "23503") {
      throw new Error(
        "Your account profile is missing, so recordings can't be saved. Please log out and back in, or ask an administrator.",
      )
    }
    throw new Error(`Could not save your submission: ${error.message}`)
  }

  try {
    await requestProcessing(submissionId)
    return { submissionId, processingError: null }
  } catch (err) {
    return { submissionId, processingError: (err as Error).message }
  }
}

export async function getSignedAudioUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(RECORDINGS_BUCKET).createSignedUrl(path, 60 * 10)
  if (error || !data) throw new Error(`Could not load the recording: ${error?.message ?? "unknown error"}`)
  return data.signedUrl
}

export async function saveFeedback(params: {
  submissionId: string
  tutorId: string
  comment: string
  strengths: string
  improvements: string
  adjustedScore: number | null
}): Promise<void> {
  const { error } = await supabase.from("tutor_feedback").upsert(
    {
      submission_id: params.submissionId,
      tutor_id: params.tutorId,
      comment: params.comment,
      strengths: params.strengths || null,
      improvements: params.improvements || null,
      adjusted_score: params.adjustedScore,
    },
    { onConflict: "submission_id" },
  )
  if (error) throw new Error(`Could not save feedback: ${error.message}`)
}

/** The tutor-adjusted score wins over the machine estimate when present. */
export const finalScore = (submission: Submission): number | null =>
  submission.feedback?.adjusted_score ?? submission.evaluation?.predicted_score ?? null

export type PrePostComparison = {
  pre: Submission | null
  post: Submission | null
  scoreChange: number | null
  percentChange: number | null
  metrics: { label: string; pre: number | null; post: number | null; unit: string }[]
}

const latestCompleted = (submissions: Submission[], kind: TaskKind) =>
  submissions
    .filter((s) => s.task?.kind === kind && s.status === "completed" && s.evaluation)
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] ?? null

// Score Change = Post - Pre; Improvement (%) = (Post - Pre) / Pre x 100 (paper, Sec. III.J).
export function comparePrePost(submissions: Submission[]): PrePostComparison {
  const pre = latestCompleted(submissions, "pre")
  const post = latestCompleted(submissions, "post")
  const preScore = pre ? finalScore(pre) : null
  const postScore = post ? finalScore(post) : null
  const scoreChange = preScore !== null && postScore !== null ? postScore - preScore : null
  const percentChange = scoreChange !== null && preScore ? (scoreChange / preScore) * 100 : null

  const metric = (s: Submission | null, pick: (e: Evaluation) => number | null) =>
    s?.evaluation ? pick(s.evaluation) : null

  return {
    pre,
    post,
    scoreChange,
    percentChange,
    metrics: [
      { label: "Speech rate", unit: "words/min", pre: metric(pre, (e) => e.acoustic_features.speech_rate), post: metric(post, (e) => e.acoustic_features.speech_rate) },
      { label: "Pauses", unit: "", pre: metric(pre, (e) => e.acoustic_features.pause_count), post: metric(post, (e) => e.acoustic_features.pause_count) },
      { label: "Average pause", unit: "s", pre: metric(pre, (e) => e.acoustic_features.avg_pause), post: metric(post, (e) => e.acoustic_features.avg_pause) },
      { label: "Lexical diversity (MATTR)", unit: "", pre: metric(pre, (e) => e.nlp_features.mattr), post: metric(post, (e) => e.nlp_features.mattr) },
      { label: "Grammar issues", unit: "", pre: metric(pre, (e) => e.nlp_features.grammar_errors), post: metric(post, (e) => e.nlp_features.grammar_errors) },
      { label: "Average sentence length", unit: "words", pre: metric(pre, (e) => e.nlp_features.avg_sentence_length), post: metric(post, (e) => e.nlp_features.avg_sentence_length) },
    ],
  }
}

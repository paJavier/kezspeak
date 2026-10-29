import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { evaluateAudio, MlServiceError } from "./kezspeak_ml.tsx";
import { geminiFeedback, GeminiError } from "./gemini_feedback.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-8450f8e5/health", (c) => {
  return c.json({ status: "ok" });
});

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Resolve the caller from their Supabase session. Returns null when the token
// is missing or invalid.
async function currentUser(authorization: string | undefined) {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { admin, id: data.user.id, role: (profile?.role ?? null) as string | null };
}

// Score an uploaded recording via the ML service (nothing is stored).
// Tutors/admins only: the browser sends its Supabase session, this function
// holds the ML API key, so the key never reaches the client.
app.post("/make-server-8450f8e5/evaluate", async (c) => {
  const user = await currentUser(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Invalid or expired session." }, 401);
  if (!user.role || !["tutor", "admin", "super_admin"].includes(user.role)) {
    return c.json({ error: "Only tutors and admins can run direct evaluations." }, 403);
  }

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) return c.json({ error: "Send the audio as a 'file' form field." }, 400);

  try {
    return c.json(await evaluateAudio(file, file.name));
  } catch (err) {
    const status = err instanceof MlServiceError ? err.status : 500;
    console.log("ML evaluate failed:", (err as Error).message);
    return c.json({ error: (err as Error).message }, status as 400);
  }
});

// Fallback: Gemini text feedback for a recording the ML pipeline couldn't
// score. Explicitly requested by the user (the UI shows a data-sharing
// notice first). No score is produced, and results go to `ai_feedback`, never
// `evaluations`.
app.post("/make-server-8450f8e5/ai-feedback", async (c) => {
  const user = await currentUser(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Invalid or expired session." }, 401);

  const { submission_id: submissionId } = await c.req.json().catch(() => ({}));
  if (typeof submissionId !== "string") return c.json({ error: "submission_id is required." }, 400);

  const { admin } = user;
  const { data: submission } = await admin
    .from("submissions")
    .select("id, learner_id, status, audio_path, mime_type, task:assessment_tasks(prompt)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission) return c.json({ error: "Submission not found." }, 404);

  const isOwner = submission.learner_id === user.id;
  let allowed = isOwner || user.role === "admin" || user.role === "super_admin";
  if (!allowed && user.role === "tutor") {
    const { data: link } = await admin
      // The student's tutor comes from the roster (tutor_learners), like kez_tutor_has_learner().
      .from("tutor_learners")
      .select("learner_id")
      .eq("tutor_id", user.id)
      .eq("learner_id", submission.learner_id)
      .limit(1);
    allowed = !!link?.length;
  }
  if (!allowed) return c.json({ error: "You cannot request feedback for this recording." }, 403);

  if (submission.status === "completed") {
    return c.json({ error: "This recording already has model results; AI fallback isn't needed." }, 409);
  }

  // One AI response per recording keeps cost predictable.
  const { data: existing } = await admin.from("ai_feedback").select("*").eq("submission_id", submissionId).maybeSingle();
  if (existing) return c.json(existing);

  const { data: audio, error: downloadError } = await admin.storage.from("recordings").download(submission.audio_path);
  if (downloadError || !audio) return c.json({ error: "Could not load the recording." }, 500);

  try {
    const task = Array.isArray(submission.task) ? submission.task[0] : submission.task;
    const feedback = await geminiFeedback(audio, submission.mime_type, task?.prompt ?? "Free speaking");
    const { data: saved, error: saveError } = await admin
      .from("ai_feedback")
      .insert({
        submission_id: submissionId,
        provider: "gemini",
        model: feedback.model,
        transcript: feedback.transcript,
        summary: feedback.summary,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        requested_by: user.id,
      })
      .select()
      .single();
    if (saveError) throw new Error(saveError.message);
    return c.json(saved);
  } catch (err) {
    const status = err instanceof GeminiError ? err.status : 500;
    console.log("AI feedback failed:", (err as Error).message);
    return c.json({ error: "AI feedback is unavailable right now. Please try again later." }, status as 500);
  }
});

Deno.serve(app.fetch);
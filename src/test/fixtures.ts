import type { Submission, TaskKind } from "../lib/assessments"
import type { Assignment } from "../lib/classroom"

// Minimal builders for unit tests. Only the fields the logic reads are real.

const DAY = 24 * 60 * 60 * 1000
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString()

export function submission(overrides: Partial<Submission> & { kind?: TaskKind; score?: number | null; adjusted?: number | null } = {}): Submission {
  const { kind = "practice", score = 70, adjusted = null, ...rest } = overrides
  return {
    id: crypto.randomUUID(),
    learner_id: "learner-1",
    task_id: `task-${kind}`,
    assignment_id: null,
    audio_path: "x.webm",
    mime_type: "audio/webm",
    duration_seconds: 60,
    status: "completed",
    error: null,
    submitted_at: daysFromNow(-1),
    updated_at: daysFromNow(-1),
    task: { id: `task-${kind}`, title: kind, prompt: "", skill_focus: null, kind, duration_seconds: 60 },
    evaluation:
      score === null
        ? null
        : ({
            predicted_score: score,
            acoustic_features: { duration: 60, speech_rate: 100, pause_count: 5, avg_pause: 0.5 },
            nlp_features: { mattr: 0.7, grammar_errors: 2, avg_sentence_length: 10 },
          } as unknown as Submission["evaluation"]),
    feedback: adjusted === null ? null : ({ adjusted_score: adjusted } as unknown as Submission["feedback"]),
    ai_feedback: null,
    learner_name: "Ana",
    ...rest,
  }
}

export function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: crypto.randomUUID(),
    task_id: "task-practice",
    learner_id: "learner-1",
    tutor_id: "tutor-1",
    due_at: null,
    status: "assigned",
    grade: null,
    graded_at: null,
    created_at: daysFromNow(-2),
    task: { title: "Task", kind: "practice", prompt: "" },
    ...overrides,
  }
}

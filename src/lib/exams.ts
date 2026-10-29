import type { Evaluation } from "./assessments"

/**
 * Exam-aligned speaking rubrics (IELTS, TOEFL iBT style, Cambridge English style).
 *
 * The tutor scores each criterion; the machine features are shown only as
 * evidence. Scores are practice estimates, never official results, and they
 * never feed `evaluations`, the 0–100 machine score or the research pre/post.
 * Descriptors are short paraphrases of the public criteria, not copied text.
 *
 * TOEFL iBT changed its format and score reporting in January 2026. This uses
 * the long-standing three speaking dimensions as a "TOEFL-style" rubric and does
 * not convert to official scaled scores. Re-check the current ETS descriptors
 * before launch.
 */

export type ExamId = "ielts" | "toefl" | "cambridge"
export type CambridgeLevel = "b2" | "c1" | "c2"

export type EvidenceKey = "speech_rate" | "pauses" | "silence" | "sentence_length" | "words" | "mattr" | "grammar" | "pronunciation"

export type Criterion = {
  key: string
  label: string
  /** One-line paraphrase shown next to the score picker. */
  description: string
  evidence: EvidenceKey[]
}

export type ExamDefinition = {
  id: ExamId
  name: string
  shortName: string
  criteria: Criterion[]
  min: number
  max: number
  /** Score label, e.g. "band" or "out of 4". */
  unit: string
  /** Allowed target scores for a learner goal. */
  targets: number[]
}

export type Rubric = {
  exam: ExamId
  scores: Record<string, number>
  notes?: Record<string, string>
}

export const PRACTICE_ESTIMATE_NOTE = "Practice estimate by your tutor, not an official score."
export const TRADEMARK_NOTE =
  "IELTS, TOEFL iBT and Cambridge English are trademarks of their owners. KezSpeak is not affiliated with them."

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => Math.round((from + i * step) * 10) / 10)

export const EXAMS: Record<ExamId, ExamDefinition> = {
  ielts: {
    id: "ielts",
    name: "IELTS Speaking",
    shortName: "IELTS",
    min: 0,
    max: 9,
    unit: "band",
    targets: range(4, 9, 0.5),
    criteria: [
      {
        key: "fluency_coherence",
        label: "Fluency & Coherence",
        description: "Speaks at length without effort; ideas are linked and easy to follow.",
        evidence: ["speech_rate", "pauses", "silence", "sentence_length"],
      },
      {
        key: "lexical_resource",
        label: "Lexical Resource",
        description: "Range and precision of vocabulary, including less common words and paraphrase.",
        evidence: ["words", "mattr"],
      },
      {
        key: "grammatical_range",
        label: "Grammatical Range & Accuracy",
        description: "Variety of sentence structures and how often they are error-free.",
        evidence: ["grammar", "sentence_length"],
      },
      {
        key: "pronunciation",
        label: "Pronunciation",
        description: "Clear sounds, stress and intonation; easy to understand throughout.",
        evidence: ["pronunciation"],
      },
    ],
  },
  toefl: {
    id: "toefl",
    name: "TOEFL iBT Speaking (style)",
    shortName: "TOEFL",
    min: 0,
    max: 4,
    unit: "out of 4",
    targets: range(1, 4, 0.5),
    criteria: [
      {
        key: "delivery",
        label: "Delivery",
        description: "Clear, fluid speech with good pace, pronunciation and intonation.",
        evidence: ["speech_rate", "pauses", "silence", "pronunciation"],
      },
      {
        key: "language_use",
        label: "Language Use",
        description: "Effective control of grammar and vocabulary to express ideas.",
        evidence: ["grammar", "words", "mattr"],
      },
      {
        key: "topic_development",
        label: "Topic Development",
        description: "Ideas answer the task fully and are connected and well supported.",
        evidence: ["sentence_length", "words"],
      },
    ],
  },
  cambridge: {
    id: "cambridge",
    name: "Cambridge English Speaking (style)",
    shortName: "Cambridge",
    min: 0,
    max: 5,
    unit: "out of 5",
    targets: range(1, 5, 0.5),
    // Interactive Communication needs a partner; KezSpeak recordings are solo.
    criteria: [
      {
        key: "grammar_vocabulary",
        label: "Grammar & Vocabulary",
        description: "Range and control of grammar and vocabulary suited to the level.",
        evidence: ["grammar", "words", "mattr"],
      },
      {
        key: "discourse_management",
        label: "Discourse Management",
        description: "Extended, relevant contributions that are organised and coherent.",
        evidence: ["speech_rate", "pauses", "sentence_length"],
      },
      {
        key: "pronunciation",
        label: "Pronunciation",
        description: "Intelligible sounds, stress and intonation.",
        evidence: ["pronunciation"],
      },
    ],
  },
}

export const EXAM_IDS = Object.keys(EXAMS) as ExamId[]
export const cambridgeLevels: Record<CambridgeLevel, string> = { b2: "B2 First", c1: "C1 Advanced", c2: "C2 Proficiency" }

export const isExamId = (value: unknown): value is ExamId => typeof value === "string" && value in EXAMS

/** IELTS rounding to the nearest half band: x.25 rounds up to x.5, x.75 up to the next whole band. */
export function ieltsRound(value: number): number {
  const whole = Math.floor(value)
  const fraction = value - whole + 1e-9
  return fraction < 0.25 ? whole : fraction < 0.75 ? whole + 0.5 : whole + 1
}

/** Overall score for a complete rubric, or null when a criterion is unscored. */
export function overallFor(rubric: Rubric | null | undefined): number | null {
  if (!rubric || !isExamId(rubric.exam)) return null
  const exam = EXAMS[rubric.exam]
  const values = exam.criteria.map((c) => rubric.scores?.[c.key])
  if (values.some((v) => typeof v !== "number" || Number.isNaN(v))) return null
  const mean = (values as number[]).reduce((sum, v) => sum + v, 0) / values.length
  return exam.id === "ielts" ? ieltsRound(mean) : Math.round(mean * 10) / 10
}

export const formatExamScore = (exam: ExamId, value: number | null | undefined) =>
  value === null || value === undefined ? "—" : exam === "ielts" ? value.toFixed(1) : `${value.toFixed(1)} / ${EXAMS[exam].max}`

export const formatChange = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`

/** How far the learner still is from their target (positive = still to go, 0 = reached). */
export function gapToTarget(overall: number | null, target: number | null | undefined): number | null {
  if (overall === null || target === null || target === undefined) return null
  return Math.max(0, Math.round((target - overall) * 10) / 10)
}

export type RubricComparison = {
  exam: ExamId
  pre: number | null
  post: number | null
  change: number | null
  criteria: { key: string; label: string; pre: number | null; post: number | null; change: number | null }[]
}

/** Pre → post per criterion. Null unless both rubrics exist and use the same exam. */
export function compareRubrics(pre: Rubric | null | undefined, post: Rubric | null | undefined): RubricComparison | null {
  if (!pre || !post || !isExamId(pre.exam) || pre.exam !== post.exam) return null
  const exam = EXAMS[pre.exam]
  const preOverall = overallFor(pre)
  const postOverall = overallFor(post)
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((b - a) * 10) / 10)
  return {
    exam: exam.id,
    pre: preOverall,
    post: postOverall,
    change: diff(preOverall, postOverall),
    criteria: exam.criteria.map((c) => {
      const a = pre.scores?.[c.key] ?? null
      const b = post.scores?.[c.key] ?? null
      return { key: c.key, label: c.label, pre: a, post: b, change: diff(a, b) }
    }),
  }
}

/** Machine features that support a criterion, as short evidence chips. */
export function evidenceFor(criterion: Criterion, evaluation: Evaluation | null | undefined): string[] {
  if (!evaluation) return []
  const a = evaluation.acoustic_features
  const n = evaluation.nlp_features
  const silence = a.duration > 0 ? Math.round(((a.duration - a.speech_duration) / a.duration) * 100) : null
  const chips: Record<EvidenceKey, string | null> = {
    speech_rate: Number.isFinite(a.speech_rate) ? `${Math.round(a.speech_rate)} words/min` : null,
    pauses: Number.isFinite(a.pause_count) ? `${a.pause_count} pauses (longest ${a.max_pause.toFixed(1)}s)` : null,
    silence: silence === null ? null : `${silence}% silent`,
    sentence_length: Number.isFinite(n.avg_sentence_length) ? `${n.avg_sentence_length.toFixed(1)} words/sentence` : null,
    words: Number.isFinite(n.word_count) ? `${n.word_count} words, ${n.unique_words} different` : null,
    mattr: Number.isFinite(n.mattr) ? `lexical diversity ${n.mattr.toFixed(2)}` : null,
    grammar: n.grammar_errors === null ? null : `${n.grammar_errors} grammar issue${n.grammar_errors === 1 ? "" : "s"} flagged`,
    pronunciation: Number.isFinite(evaluation.predicted_score) ? `machine pronunciation estimate ${Math.round(evaluation.predicted_score)}/100` : null,
  }
  return criterion.evidence.map((key) => chips[key]).filter((chip): chip is string => chip !== null)
}

/** Score options for a criterion picker. */
export const scoreOptions = (exam: ExamId) => range(EXAMS[exam].min, EXAMS[exam].max, 1)

// ---------------------------------------------------------------------------
// Exam-style task templates (original KezSpeak prompts, not real exam items)
// ---------------------------------------------------------------------------

export type ExamStyle = "ielts_part1" | "ielts_part2" | "ielts_part3" | "toefl_independent" | "cambridge_long_turn"

export type ExamTemplate = {
  style: ExamStyle
  exam: ExamId
  label: string
  title: string
  prompt: string
  followUps: string[]
  skillFocus: string
  durationSeconds: number
  prepSeconds: number
}

export const EXAM_TEMPLATES: ExamTemplate[] = [
  {
    style: "ielts_part1",
    exam: "ielts",
    label: "IELTS Part 1 · Interview",
    title: "About Your Hometown",
    prompt: "Answer these short questions about where you live. Give a full answer to each, with a reason or an example.",
    followUps: ["Where is your hometown?", "What do you like most about living there?", "How has it changed in recent years?"],
    skillFocus: "Fluency & familiar topics",
    durationSeconds: 60,
    prepSeconds: 0,
  },
  {
    style: "ielts_part2",
    exam: "ielts",
    label: "IELTS Part 2 · Cue card",
    title: "A Skill You Learned",
    prompt: "Describe a skill you learned that you are proud of.\nYou should say:\n- what the skill is\n- when and how you learned it\n- who helped you\nand explain why you are proud of it.",
    followUps: [],
    skillFocus: "Long turn",
    durationSeconds: 120,
    prepSeconds: 60,
  },
  {
    style: "ielts_part3",
    exam: "ielts",
    label: "IELTS Part 3 · Discussion",
    title: "Learning New Skills",
    prompt: "Discuss these questions in depth. Give your opinion, explain your reasons and compare different points of view.",
    followUps: ["Why do some people learn new skills faster than others?", "Should schools teach more practical skills?", "How will technology change the way people learn?"],
    skillFocus: "Giving and supporting opinions",
    durationSeconds: 90,
    prepSeconds: 0,
  },
  {
    style: "toefl_independent",
    exam: "toefl",
    label: "TOEFL-style · Independent task",
    title: "Studying Alone or in Groups",
    prompt: "Some students prefer to study alone, while others prefer to study in a group. Which do you prefer, and why? Use specific reasons and examples to support your answer.",
    followUps: [],
    skillFocus: "Stating and supporting a preference",
    durationSeconds: 45,
    prepSeconds: 15,
  },
  {
    style: "cambridge_long_turn",
    exam: "cambridge",
    label: "Cambridge-style · Long turn",
    title: "Ways of Relaxing",
    prompt: "Think about two different ways people relax: spending time outdoors and staying at home.\nCompare them and say why people might choose each one, and which you think is more relaxing.",
    followUps: [],
    skillFocus: "Comparing and speculating",
    durationSeconds: 60,
    prepSeconds: 0,
  },
]

export const examStyleLabels: Record<ExamStyle, string> = Object.fromEntries(
  EXAM_TEMPLATES.map((t) => [t.style, t.label]),
) as Record<ExamStyle, string>

export const examForStyle = (style: string | null | undefined): ExamId | null =>
  EXAM_TEMPLATES.find((t) => t.style === style)?.exam ?? null

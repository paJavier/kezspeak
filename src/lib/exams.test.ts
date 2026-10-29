import { describe, expect, it } from "vitest"
import type { Evaluation } from "./assessments"
import { compareRubrics, EXAMS, evidenceFor, gapToTarget, ieltsRound, overallFor, type Rubric } from "./exams"

const ielts = (fc: number, lr: number, gr: number, p: number): Rubric => ({
  exam: "ielts",
  scores: { fluency_coherence: fc, lexical_resource: lr, grammatical_range: gr, pronunciation: p },
})

describe("ieltsRound", () => {
  it("rounds to the nearest half band, with x.25 and x.75 rounding up", () => {
    expect(ieltsRound(6.125)).toBe(6)
    expect(ieltsRound(6.25)).toBe(6.5)
    expect(ieltsRound(6.5)).toBe(6.5)
    expect(ieltsRound(6.75)).toBe(7)
  })
})

describe("overallFor", () => {
  it("averages IELTS criteria and rounds like IELTS", () => {
    expect(overallFor(ielts(6, 5, 6, 6))).toBe(6) // mean 5.75
    expect(overallFor(ielts(6, 6, 6, 7))).toBe(6.5) // mean 6.25
  })

  it("uses one decimal for TOEFL-style and Cambridge-style", () => {
    expect(overallFor({ exam: "toefl", scores: { delivery: 3, language_use: 3, topic_development: 2 } })).toBe(2.7)
    expect(overallFor({ exam: "cambridge", scores: { grammar_vocabulary: 4, discourse_management: 3, pronunciation: 4 } })).toBe(3.7)
  })

  it("is null until every criterion is scored", () => {
    expect(overallFor({ exam: "ielts", scores: { fluency_coherence: 6 } })).toBeNull()
    expect(overallFor(null)).toBeNull()
  })
})

describe("compareRubrics", () => {
  it("reports overall and per-criterion change", () => {
    const result = compareRubrics(ielts(5, 5, 5, 6), ielts(6, 6, 6, 6))
    expect(result?.pre).toBe(5.5) // mean 5.25
    expect(result?.post).toBe(6)
    expect(result?.change).toBe(0.5)
    expect(result?.criteria.find((c) => c.key === "fluency_coherence")?.change).toBe(1)
  })

  it("is null when the exams differ or one side is missing", () => {
    const toefl: Rubric = { exam: "toefl", scores: { delivery: 3, language_use: 3, topic_development: 3 } }
    expect(compareRubrics(ielts(6, 6, 6, 6), toefl)).toBeNull()
    expect(compareRubrics(null, ielts(6, 6, 6, 6))).toBeNull()
  })
})

describe("gapToTarget", () => {
  it("never goes below zero", () => {
    expect(gapToTarget(6, 7)).toBe(1)
    expect(gapToTarget(7.5, 7)).toBe(0)
    expect(gapToTarget(null, 7)).toBeNull()
  })
})

describe("evidenceFor", () => {
  const evaluation = {
    predicted_score: 81.4,
    acoustic_features: { duration: 60, speech_duration: 54, speech_rate: 174.2, pause_count: 25, avg_pause: 0.2, max_pause: 0.9 },
    nlp_features: { word_count: 128, unique_words: 85, mattr: 0.98, grammar_errors: null, avg_sentence_length: 25.6 },
  } as unknown as Evaluation

  it("shows fluency features for fluency and the machine estimate for pronunciation", () => {
    const [fluency, , , pronunciation] = EXAMS.ielts.criteria
    expect(evidenceFor(fluency, evaluation)).toEqual(["174 words/min", "25 pauses (longest 0.9s)", "10% silent", "25.6 words/sentence"])
    expect(evidenceFor(pronunciation, evaluation)).toEqual(["machine pronunciation estimate 81/100"])
  })

  it("skips grammar when LanguageTool did not run", () => {
    const grammar = EXAMS.ielts.criteria[2]
    expect(evidenceFor(grammar, evaluation)).toEqual(["25.6 words/sentence"])
  })
})

import { describe, expect, it, vi } from "vitest"
import { daysFromNow, submission } from "../test/fixtures"

vi.mock("./supabase", () => ({ supabase: {} }))
const { needsReview, summarizeLearners } = await import("./progress")

describe("summarizeLearners", () => {
  it("adds students who have not recorded yet as 'Not assessed yet'", () => {
    const rows = summarizeLearners(
      [submission({ learner_id: "a", kind: "pre" })],
      [
        { id: "a", full_name: "Ana", role: "student" },
        { id: "b", full_name: "Ben", role: "student" },
        { id: "t", full_name: "Tutor", role: "tutor" },
      ],
    )
    expect(rows.map((r) => r.learnerId)).toEqual(["a", "b"])
    const ben = rows.find((r) => r.learnerId === "b")
    expect(ben?.status).toBe("Not assessed yet")
    expect(ben?.submissions).toHaveLength(0)
    expect(ben?.name).toBe("Ben")
  })

  it("never lists non-students from the people list", () => {
    const rows = summarizeLearners([], [{ id: "t", full_name: "Tutor", role: "tutor" }])
    expect(rows).toHaveLength(0)
  })

  it("still works from submissions alone (people list unavailable)", () => {
    const rows = summarizeLearners([submission({ learner_id: "a" })], null)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe("Ana")
  })

  it("lists recent activity first, then learners without activity by name", () => {
    const rows = summarizeLearners(
      [submission({ learner_id: "old", submitted_at: daysFromNow(-5) }), submission({ learner_id: "new", submitted_at: daysFromNow(-1) })],
      [
        { id: "zed", full_name: "Zed", role: "student" },
        { id: "amy", full_name: "Amy", role: "student" },
      ],
    )
    expect(rows.map((r) => r.learnerId)).toEqual(["new", "old", "amy", "zed"])
  })

  it("flags a scored recording without feedback as 'Needs review'", () => {
    const rows = summarizeLearners([submission({ learner_id: "a" })])
    expect(rows[0].status).toBe("Needs review")
  })
})

describe("needsReview", () => {
  it("is true only for completed, scored recordings without tutor feedback", () => {
    expect(needsReview(submission())).toBe(true)
    expect(needsReview(submission({ adjusted: 75 }))).toBe(false)
    expect(needsReview(submission({ status: "processing" }))).toBe(false)
    expect(needsReview(submission({ score: null }))).toBe(false)
  })
})

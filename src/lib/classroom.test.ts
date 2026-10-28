import { describe, expect, it, vi } from "vitest"
import { assignment, daysFromNow, submission } from "../test/fixtures"

// classroom.ts imports the Supabase client; these tests only cover pure logic.
vi.mock("./supabase", () => ({ supabase: {} }))
const { classworkState, displayGrade, isOpenAssignment, latestSubmissionFor, suggestedGrade } = await import("./classroom")

describe("classworkState", () => {
  it("is 'todo' while assigned and before the deadline", () => {
    expect(classworkState(assignment({ due_at: daysFromNow(1) }))).toBe("todo")
    expect(classworkState(assignment({ due_at: null }))).toBe("todo")
  })

  it("treats overdue unsubmitted work as missing, even before the DB closes it", () => {
    expect(classworkState(assignment({ due_at: daysFromNow(-1) }))).toBe("missing")
    expect(classworkState(assignment({ status: "missing" }))).toBe("missing")
  })

  it("maps submitted/reviewed to 'turned_in' and graded to 'graded'", () => {
    expect(classworkState(assignment({ status: "submitted", due_at: daysFromNow(-1) }))).toBe("turned_in")
    expect(classworkState(assignment({ status: "reviewed" }))).toBe("turned_in")
    expect(classworkState(assignment({ status: "graded", grade: 80 }))).toBe("graded")
  })
})

describe("displayGrade", () => {
  it("shows the tutor's grade when set", () => {
    expect(displayGrade(assignment({ status: "graded", grade: 85 }))).toBe(85)
  })

  it("shows 0 for missing work and nothing for open work", () => {
    expect(displayGrade(assignment({ due_at: daysFromNow(-1) }))).toBe(0)
    expect(displayGrade(assignment({ due_at: daysFromNow(1) }))).toBeNull()
  })
})

describe("isOpenAssignment (matches the database's recording rule)", () => {
  it("is open while assigned or turned in and before the deadline", () => {
    expect(isOpenAssignment(assignment())).toBe(true)
    expect(isOpenAssignment(assignment({ status: "submitted", due_at: daysFromNow(1) }))).toBe(true)
  })

  it("is closed once graded, missing or overdue", () => {
    expect(isOpenAssignment(assignment({ status: "graded", grade: 70 }))).toBe(false)
    expect(isOpenAssignment(assignment({ status: "missing" }))).toBe(false)
    expect(isOpenAssignment(assignment({ due_at: daysFromNow(-1) }))).toBe(false)
  })
})

describe("latestSubmissionFor", () => {
  it("returns the newest recording linked to the assignment and ignores others", () => {
    const a = assignment()
    const older = submission({ assignment_id: a.id, submitted_at: daysFromNow(-3) })
    const newer = submission({ assignment_id: a.id, submitted_at: daysFromNow(-1) })
    const unrelated = submission({ assignment_id: "other", submitted_at: daysFromNow(0) })
    expect(latestSubmissionFor(a, [older, unrelated, newer])?.id).toBe(newer.id)
    expect(latestSubmissionFor(a, [unrelated])).toBeNull()
    expect(latestSubmissionFor(a, null)).toBeNull()
  })
})

describe("suggestedGrade", () => {
  it("prefers the tutor-adjusted score, then the machine estimate, rounded", () => {
    expect(suggestedGrade(submission({ score: 71.6 }))).toBe(72)
    expect(suggestedGrade(submission({ score: 71.6, adjusted: 80 }))).toBe(80)
  })

  it("is null without a scored recording", () => {
    expect(suggestedGrade(null)).toBeNull()
    expect(suggestedGrade(submission({ score: null }))).toBeNull()
  })
})

import { describe, expect, it, vi } from "vitest"
import { daysFromNow, submission } from "../test/fixtures"

vi.mock("./supabase", () => ({ supabase: {} }))
const { comparePrePost, finalScore } = await import("./assessments")

describe("comparePrePost (paper Sec. III.J)", () => {
  it("computes score change and improvement % from pre and post", () => {
    const result = comparePrePost([
      submission({ kind: "pre", score: 50, submitted_at: daysFromNow(-10) }),
      submission({ kind: "post", score: 60, submitted_at: daysFromNow(-1) }),
    ])
    expect(result.scoreChange).toBe(10)
    expect(result.percentChange).toBe(20)
  })

  it("uses the FIRST completed pre-assessment as the baseline (a re-take can't move it)", () => {
    const first = submission({ kind: "pre", score: 50, submitted_at: daysFromNow(-20) })
    const retake = submission({ kind: "pre", score: 70, submitted_at: daysFromNow(-10) })
    const post = submission({ kind: "post", score: 65, submitted_at: daysFromNow(-1) })
    const result = comparePrePost([post, retake, first])
    expect(result.pre?.id).toBe(first.id)
    expect(result.scoreChange).toBe(15)
  })

  it("only counts a post-assessment recorded after the baseline", () => {
    const earlyPost = submission({ kind: "post", score: 90, submitted_at: daysFromNow(-30) })
    const pre = submission({ kind: "pre", score: 50, submitted_at: daysFromNow(-20) })
    const result = comparePrePost([earlyPost, pre])
    expect(result.post).toBeNull()
    expect(result.scoreChange).toBeNull()
  })

  it("uses the latest post after the baseline", () => {
    const pre = submission({ kind: "pre", score: 50, submitted_at: daysFromNow(-20) })
    const post1 = submission({ kind: "post", score: 55, submitted_at: daysFromNow(-10) })
    const post2 = submission({ kind: "post", score: 62, submitted_at: daysFromNow(-2) })
    expect(comparePrePost([post1, pre, post2]).post?.id).toBe(post2.id)
  })

  it("ignores recordings that are not completed or not scored", () => {
    const result = comparePrePost([
      submission({ kind: "pre", status: "failed", submitted_at: daysFromNow(-5) }),
      submission({ kind: "pre", score: null, submitted_at: daysFromNow(-4) }),
    ])
    expect(result.pre).toBeNull()
  })

  it("uses the tutor-adjusted score when present", () => {
    const result = comparePrePost([
      submission({ kind: "pre", score: 50, adjusted: 40, submitted_at: daysFromNow(-10) }),
      submission({ kind: "post", score: 60, submitted_at: daysFromNow(-1) }),
    ])
    expect(result.scoreChange).toBe(20)
  })
})

describe("finalScore", () => {
  it("prefers the tutor-adjusted score over the machine estimate", () => {
    expect(finalScore(submission({ score: 70 }))).toBe(70)
    expect(finalScore(submission({ score: 70, adjusted: 82 }))).toBe(82)
    expect(finalScore(submission({ score: null }))).toBeNull()
  })
})

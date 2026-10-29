import { describe, expect, it, vi } from "vitest"

// notifications.ts imports the Supabase client; these tests only cover pure logic.
vi.mock("./supabase", () => ({ supabase: {} }))
const { audienceLabel, audienceOptions, matchesNotificationFilter, notificationFilters, safeNotificationDestination } =
  await import("./notifications")

describe("notificationFilters", () => {
  it("gives staff only the filters they receive notifications for", () => {
    for (const role of ["tutor", "admin", "super_admin"] as const) {
      expect(notificationFilters(role)).toEqual(["all", "unread", "announcements", "submissions"])
    }
  })

  it("keeps the assessment and score filters for students", () => {
    expect(notificationFilters("student")).toEqual(["all", "unread", "announcements", "assessments", "scores"])
  })

  it("files graded classwork under scores", () => {
    expect(matchesNotificationFilter("scores", "assignment_graded")).toBe(true)
    expect(matchesNotificationFilter("submissions", "review_required")).toBe(true)
    expect(matchesNotificationFilter("submissions", "announcement")).toBe(false)
  })
})

describe("audienceOptions", () => {
  it("lets administrators and moderators address everyone, students or tutors", () => {
    expect(audienceOptions("super_admin")).toEqual(["everyone", "students", "tutors"])
    expect(audienceOptions("admin")).toEqual(["everyone", "students", "tutors"])
  })

  it("limits tutors to their students and students to nothing", () => {
    expect(audienceOptions("tutor")).toEqual(["students"])
    expect(audienceOptions("student")).toEqual([])
  })
})

describe("audienceLabel", () => {
  it("names a tutor's audience as their own students", () => {
    expect(audienceLabel("students", "tutor")).toBe("My students")
    expect(audienceLabel("students", "admin")).toBe("All students")
    expect(audienceLabel("everyone", "super_admin")).toBe("Everyone")
  })
})

describe("safeNotificationDestination", () => {
  it("falls back to notifications for pages the role cannot open", () => {
    expect(safeNotificationDestination("student", "users")).toBe("notifications")
    expect(safeNotificationDestination("tutor", "announcements")).toBe("announcements")
  })
})

import { describe, expect, it, vi } from "vitest"

// admin.ts imports the Supabase client; these tests only cover pure logic.
vi.mock("./supabase", () => ({ supabase: {} }))
const { draftPrompt, splitPrompt } = await import("./admin")

describe("splitPrompt", () => {
  it("reverses draftPrompt", () => {
    const questions = ["What do you like?", "What would you change?"]
    expect(splitPrompt(draftPrompt("Describe your city.", questions))).toEqual({ prompt: "Describe your city.", followUps: questions })
  })

  it("leaves prompts without a follow-up block unchanged", () => {
    expect(splitPrompt("Describe your city.")).toEqual({ prompt: "Describe your city.", followUps: [] })
  })

  it("ignores 'Also answer:' text that is not a question list", () => {
    const prompt = "Read the text.\n\nAlso answer:\nwhy you agree, in two sentences."
    expect(splitPrompt(prompt)).toEqual({ prompt, followUps: [] })
  })
})

describe("draftPrompt", () => {
  it("appends follow-up questions as a list under the prompt", () => {
    expect(draftPrompt(" Describe your city. ", ["What do you like?", " ", "What would you change?"])).toBe(
      "Describe your city.\n\nAlso answer:\n- What do you like?\n- What would you change?",
    )
  })

  it("keeps the prompt alone when there are no questions", () => {
    expect(draftPrompt("Describe your city.", ["", "  "])).toBe("Describe your city.")
  })
})

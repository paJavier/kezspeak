// Fallback feedback from Google Gemini when the KezSpeak ML pipeline can't
// score a recording. Text only: no score, no proficiency level, so it never
// competes with the validated model or the pre/post comparison.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets, or .env.local when
// serving locally). Never put these in the frontend:
//   GEMINI_API_KEY  from https://aistudio.google.com/apikey
//   GEMINI_MODEL    optional, defaults below (any audio-capable Gemini model)

import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const DEFAULT_MODEL = "gemini-3.5-flash"; // gemini-2.5-flash is closed to new API keys

export type GeminiFeedback = {
  transcript: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  model: string;
};

export class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const PROMPT = `You are helping an English tutor at Kez Tutorial Service give feedback on an ESL learner's recorded speaking response.

Speaking task: "{TASK}"

Listen to the recording and respond in JSON with:
- "transcript": what the learner said, verbatim, including hesitations like "um".
- "summary": 2-3 encouraging sentences about how they did on fluency, pronunciation, grammar and vocabulary.
- "strengths": 2-3 short, specific things they did well.
- "improvements": 2-3 short, specific, actionable suggestions.

Rules: do NOT give any numeric score, grade, band, or CEFR level. Be supportive and concrete, refer to words they actually used, and write for a learner, not a teacher. If the audio has no speech, say so in the summary and leave the lists empty.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    summary: { type: "STRING" },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    improvements: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["transcript", "summary", "strengths", "improvements"],
};

export async function geminiFeedback(audio: Blob, mimeType: string, taskPrompt: string): Promise<GeminiFeedback> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY secret is not set.", 500);
  const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_MODEL;

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT.replace("{TASK}", taskPrompt) },
          { inline_data: { mime_type: mimeType, data: encodeBase64(new Uint8Array(await audio.arrayBuffer())) } },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0.4 },
  };

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    throw new GeminiError(`Gemini unreachable: ${(err as Error).message}`, 502);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new GeminiError(`Gemini returned ${response.status}: ${detail.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  // Newer models may return thinking parts first; keep only the answer text.
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!text) throw new GeminiError("Gemini returned no feedback (possibly blocked by safety filters).", 502);

  const parsed = JSON.parse(text);
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String).slice(0, 5) : []);
  return {
    transcript: String(parsed.transcript ?? ""),
    summary: String(parsed.summary ?? ""),
    strengths: list(parsed.strengths),
    improvements: list(parsed.improvements),
    model,
  };
}

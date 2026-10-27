// Server-to-server client for the KezSpeak ML service (POST /evaluate).
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets, or
// `supabase secrets set ...`). Never put these in the frontend:
//   KEZSPEAK_ML_URL   public URL of the FastAPI service, e.g. https://kezspeak-ml.onrender.com
//   KEZSPEAK_API_KEY  same value as KEZSPEAK_API_KEY in .env.local
// Locally: `supabase functions serve --env-file .env.local`.

export type MlEvaluation = {
  duration_seconds: number
  transcript: string
  acoustic_features: Record<string, number>
  nlp_features: Record<string, number | null>
  predicted_score: number
  model_version: string
  feature_version: string
  processing_ms: number
}

export class MlServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function mlConfig() {
  const baseUrl = Deno.env.get("KEZSPEAK_ML_URL")?.replace(/\/+$/, "")
  const apiKey = Deno.env.get("KEZSPEAK_API_KEY")
  if (!baseUrl || !apiKey) {
    throw new MlServiceError("KEZSPEAK_ML_URL and KEZSPEAK_API_KEY secrets are not set.", 500)
  }
  return { baseUrl, apiKey }
}

/** Send raw audio to the ML service and return the transcript, features and machine estimate. */
export async function evaluateAudio(audio: Blob, filename = "recording.webm"): Promise<MlEvaluation> {
  const { baseUrl, apiKey } = mlConfig()
  const form = new FormData()
  form.append("file", audio, filename)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/evaluate`, {
      method: "POST",
      // Let fetch set the multipart boundary; only add the key.
      headers: { access_token: apiKey },
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
  } catch (err) {
    throw new MlServiceError(`ML service unreachable: ${(err as Error).message}`, 502)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new MlServiceError(body?.detail ?? `ML service returned ${response.status}`, response.status)
  }
  return await response.json()
}

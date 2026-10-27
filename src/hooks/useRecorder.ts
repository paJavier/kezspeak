import { useCallback, useEffect, useRef, useState } from "react"

export type RecorderState = "idle" | "recording" | "paused" | "stopped"

const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]

const pickMimeType = () =>
  PREFERRED_TYPES.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? ""

function describeMicError(err: unknown): string {
  const name = (err as DOMException)?.name
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access was blocked. Allow the microphone in your browser's address bar, then try again."
  if (name === "NotFoundError") return "No microphone was found. Connect one and try again."
  if (name === "NotReadableError") return "Your microphone is being used by another app."
  return "Could not start recording in this browser."
}

/** Browser recording with pause/resume, a timer and an automatic stop at maxSeconds. */
export default function useRecorder(maxSeconds: number) {
  const [state, setState] = useState<RecorderState>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const accumulatedRef = useRef(0)

  const stopTimer = () => {
    if (tickRef.current !== null) window.clearInterval(tickRef.current)
    tickRef.current = null
  }

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
  }, [])

  const startTimer = useCallback(() => {
    startedAtRef.current = performance.now()
    tickRef.current = window.setInterval(() => {
      const seconds = accumulatedRef.current + (performance.now() - startedAtRef.current) / 1000
      setElapsed(seconds)
      if (seconds >= maxSeconds) stop()
    }, 200)
  }, [maxSeconds, stop])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio. Try the latest Chrome, Edge or Firefox.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      accumulatedRef.current = 0

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        // The timer only runs while recording, so it tells us whether the
        // last stretch (since start/resume) still needs adding.
        if (tickRef.current !== null)
          accumulatedRef.current += (performance.now() - startedAtRef.current) / 1000
        stopTimer()
        setElapsed(Math.min(accumulatedRef.current, maxSeconds))
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" })
        setBlob(recording)
        setUrl(URL.createObjectURL(recording))
        setState("stopped")
        releaseStream()
      }

      recorderRef.current = recorder
      recorder.start(1000)
      setElapsed(0)
      setState("recording")
      startTimer()
    } catch (err) {
      releaseStream()
      setError(describeMicError(err))
    }
  }, [maxSeconds, startTimer])

  const pause = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state !== "recording") return
    recorder.pause()
    stopTimer()
    accumulatedRef.current += (performance.now() - startedAtRef.current) / 1000
    setState("paused")
  }, [])

  const resume = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state !== "paused") return
    recorder.resume()
    setState("recording")
    startTimer()
  }, [startTimer])

  const reset = useCallback(() => {
    // Detach onstop first so a recording in progress is discarded, not saved.
    if (recorderRef.current) recorderRef.current.onstop = null
    stop()
    stopTimer()
    releaseStream()
    setBlob(null)
    setUrl(null) // the effect below revokes the old object URL
    setElapsed(0)
    setError(null)
    setState("idle")
  }, [stop])

  useEffect(
    () => () => {
      stopTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null
        recorder.stop()
      }
      releaseStream()
    },
    [],
  )

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  return { state, elapsed, blob, url, error, start, pause, resume, stop, reset }
}

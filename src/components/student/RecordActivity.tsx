import { useEffect, useState } from "react"
import useRecorder from "../../hooks/useRecorder"
import useSubmission from "../../hooks/useSubmission"
import { listTasks, submitRecording, type AssessmentTask } from "../../lib/assessments"
import EvaluationSummary from "../EvaluationSummary"
import ProcessingStatus from "../ProcessingStatus"
import { Mic, Wave } from "../icons"

const kindLabels = { pre: "Pre-Assessment", post: "Post-Assessment", practice: "Practice" }

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

function Recorder({
  task,
  learnerId,
  onSubmitted,
}: {
  task: AssessmentTask
  learnerId: string
  onSubmitted: (submissionId: string, processingError: string | null) => void
}) {
  const recorder = useRecorder(task.duration_seconds)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const recording = recorder.state === "recording" || recorder.state === "paused"
  // Exam-style preparation time (e.g. 60 s for an IELTS Part 2 cue card). null = not preparing.
  const prepSeconds = task.prep_seconds ?? 0
  const [prepLeft, setPrepLeft] = useState<number | null>(null)
  const { start } = recorder

  useEffect(() => {
    if (prepLeft === null) return
    if (prepLeft <= 0) {
      setPrepLeft(null)
      void start()
      return
    }
    const timer = window.setTimeout(() => setPrepLeft((s) => (s === null ? null : s - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [prepLeft, start])

  const startNow = () => {
    setPrepLeft(null)
    void start()
  }

  const submit = async () => {
    if (!recorder.blob) return
    setUploading(true)
    setUploadError(null)
    try {
      const { submissionId, processingError } = await submitRecording({
        learnerId,
        task,
        audio: recorder.blob,
        durationSeconds: recorder.elapsed,
      })
      onSubmitted(submissionId, processingError)
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-8 rounded-[32px] bg-white p-8 shadow-sm">
      <span className="rounded-full bg-kez-yellow-light px-4 py-2 text-sm font-bold text-amber-800">
        {prepSeconds > 0 ? `${prepSeconds}s to prepare · ` : ""}Up to {task.duration_seconds} seconds
      </span>
      <div
        className={`mx-auto mt-8 grid size-40 place-items-center rounded-full ${recorder.state === "recording"
          ? "bg-red-50 text-red-500 ring-8 ring-red-100"
          : "bg-kez-blue text-kez-yellow"
          }`}
      >
        <Mic size={58} />
      </div>

      {recording ? (
        <>
          <p className="mt-6 text-3xl font-extrabold">
            {clock(recorder.elapsed)}
            <span className="text-base text-slate-400"> / {clock(task.duration_seconds)}</span>
          </p>
          <div className={`mx-auto mt-5 w-fit ${recorder.state === "paused" ? "opacity-30" : ""}`}>
            <Wave />
          </div>
          <div className="mt-7 flex justify-center gap-3">
            {recorder.state === "recording" ? (
              <button onClick={recorder.pause} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold">
                Pause
              </button>
            ) : (
              <button onClick={recorder.resume} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold">
                Resume
              </button>
            )}
            <button onClick={recorder.stop} className="rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white">
              Stop
            </button>
          </div>
        </>
      ) : recorder.state === "stopped" && recorder.url ? (
        <>
          <p className="mt-6 text-sm font-bold text-slate-500">Listen back before you submit ({clock(recorder.elapsed)})</p>
          <audio controls src={recorder.url} className="mx-auto mt-3 w-full max-w-md" />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={recorder.reset}
              disabled={uploading}
              className="flex-1 rounded-xl bg-kez-blue-light py-4 text-sm font-bold text-kez-blue disabled:opacity-60"
            >
              ↺ Record again
            </button>
            <button
              onClick={submit}
              disabled={uploading}
              className="flex-1 rounded-xl bg-kez-blue py-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Submit"}
            </button>
          </div>
        </>
      ) : prepLeft !== null ? (
        <div className="mt-6" role="timer" aria-live="polite">
          <p className="text-xs font-bold tracking-wider text-amber-800">PREPARATION TIME</p>
          <p className="mt-1 text-4xl font-extrabold">{clock(prepLeft)}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Read the task above and plan what you'll say. Recording starts automatically when the time is up.
          </p>
          <button onClick={startNow} className="mt-5 rounded-xl bg-kez-blue px-6 py-3 text-sm font-bold text-white">
            🎤 Start recording now
          </button>
        </div>
      ) : prepSeconds > 0 ? (
        <button onClick={() => setPrepLeft(prepSeconds)} className="mt-7 rounded-xl bg-kez-blue px-6 py-4 text-sm font-bold text-white">
          ⏱ Start {prepSeconds}s preparation
        </button>
      ) : (
        <button onClick={recorder.start} className="mt-7 rounded-xl bg-kez-blue px-6 py-4 text-sm font-bold text-white">
          🎤 Start Recording
        </button>
      )}

      {(recorder.error || uploadError) && (
        <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{recorder.error ?? uploadError}</p>
      )}
      <p className="mt-7 text-sm font-semibold text-slate-500">Speak naturally. Take your time. You’ve got this! 🌟</p>
    </div>
  )
}

/** Pick a speaking task, record, submit, and follow the analysis to the result. */
export default function RecordActivity({
  learnerId,
  onViewResults,
  initialTaskId = null,
  openTaskIds,
}: {
  learnerId: string
  onViewResults: () => void
  initialTaskId?: string | null
  /** Pre/post tasks the learner has an open assignment for; others are hidden (the DB refuses them too). */
  openTaskIds?: Set<string>
}) {
  // null = still loading; [] = nothing to record yet.
  const [tasks, setTasks] = useState<AssessmentTask[] | null>(null)
  const [taskId, setTaskId] = useState<string | null>(initialTaskId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const { submission, error: pollError, refresh } = useSubmission(submissionId)

  useEffect(() => {
    listTasks()
      .then((all) => {
        const list = all.filter((t) => !openTaskIds || t.kind === "practice" || openTaskIds.has(t.id))
        setTasks(list)
        if (initialTaskId && !list.some((t) => t.id === initialTaskId) && all.some((t) => t.id === initialTaskId)) {
          setNotice("That assessment hasn't been assigned to you yet. Your tutor will assign it when it's time. You can practice in the meantime.")
        }
        setTaskId((current) =>
          current && list.some((t) => t.id === current) ? current : (list.find((t) => t.kind === "practice")?.id ?? list[0]?.id ?? null),
        )
      })
      .catch((err: Error) => setLoadError(err.message))
  }, [])

  const task = tasks?.find((t) => t.id === taskId) ?? null

  if (loadError) return <p className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">{loadError}</p>
  if (!tasks) return <p className="text-center text-slate-500">Loading speaking tasks…</p>
  if (!tasks.length) {
    return (
      <section className="mx-auto max-w-3xl text-center">
        {notice && <p className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{notice}</p>}
        <div className="rounded-[32px] bg-white p-8 shadow-sm">
          <h2 className="text-xl font-extrabold">No speaking tasks yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Your tutor will add practice tasks and assign your assessments when it's time.
          </p>
          <button onClick={onViewResults} className="mt-6 rounded-xl bg-kez-blue-light px-6 py-3 text-sm font-bold text-kez-blue">
            See my results
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl text-center">
      {notice && !submissionId && <p className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{notice}</p>}
      {!submissionId && (
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setTaskId(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${t.id === taskId ? "bg-kez-blue text-white" : "bg-white text-slate-500"
                }`}
            >
              {kindLabels[t.kind]} · {t.title}
            </button>
          ))}
        </div>
      )}

      {task && (
        <>
          <h2 className="text-xl font-extrabold">{task.title}</h2>
          <p className="mt-3 whitespace-pre-line text-lg leading-8 text-slate-600">{task.prompt}</p>
        </>
      )}

      {task && !submissionId && (
        <Recorder
          key={task.id}
          task={task}
          learnerId={learnerId}
          onSubmitted={(id, processingError) => {
            setSubmissionId(id)
            setStartError(processingError)
          }}
        />
      )}

      {submissionId && (
        <div className="mt-8 space-y-5">
          {pollError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{pollError}</p>}
          {!submission && !pollError && <p className="text-slate-500">Saving your recording…</p>}
          {submission && submission.status !== "completed" && (
            <ProcessingStatus
              submission={submission}
              startError={startError}
              onRetried={() => {
                setStartError(null)
                refresh()
              }}
            />
          )}
          {submission?.status === "completed" && submission.evaluation && (
            <div className="text-left">
              <EvaluationSummary evaluation={submission.evaluation} feedback={submission.feedback} />
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                setSubmissionId(null)
                setStartError(null)
              }}
              className="flex-1 rounded-xl bg-kez-blue-light py-4 text-sm font-bold text-kez-blue"
            >
              Record another task
            </button>
            <button onClick={onViewResults} className="flex-1 rounded-xl bg-kez-dark py-4 text-sm font-bold text-white">
              See all my results
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

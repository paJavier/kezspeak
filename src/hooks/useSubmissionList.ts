import { useCallback, useEffect, useState } from "react"
import { listSubmissions, type Submission } from "../lib/assessments"

/**
 * Submissions visible to the current user (RLS: learners see their own, tutors
 * their assigned learners', admins all). Pass a learnerId to narrow it.
 */
export default function useSubmissionList(learnerId?: string) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    listSubmissions(learnerId)
      .then((data) => {
        if (cancelled) return
        setSubmissions(data)
        setError(null)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [learnerId, version])

  return { submissions, error, reload }
}

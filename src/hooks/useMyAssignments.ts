import { useCallback, useEffect, useState } from "react"
import { isOpenAssignment, listAssignments, type Assignment } from "../lib/classroom"

/**
 * The signed-in learner's assignments, plus the task ids they may record as a
 * pre/post-assessment right now (open assignments only; the DB enforces the same).
 */
export default function useMyAssignments() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    listAssignments()
      .then((data) => {
        if (cancelled) return
        setAssignments(data)
        setError(null)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [version])

  const openTaskIds = new Set((assignments ?? []).filter(isOpenAssignment).map((a) => a.task_id))
  return { assignments, error, reload, openTaskIds }
}

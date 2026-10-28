import { useCallback, useEffect, useState } from "react"
import { listPeople, type Person } from "../lib/classroom"

/**
 * People visible to the current user (kez_list_people: admins see everyone,
 * tutors the students set to them). Used so learners show up before their
 * first recording.
 */
export default function usePeople() {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    listPeople()
      .then((data) => {
        if (cancelled) return
        setPeople(data)
        setError(null)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [version])

  return { people, error, reload }
}

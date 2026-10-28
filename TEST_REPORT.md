# KezSpeak test report: 28 Oct 2026

Scope: the whole app after the classwork, statistics, navigation and role-label changes (none of it committed yet).
Tested by: Claude Code, on the developer laptop (Windows 11, 7.7 GB RAM).

## Summary

| Area | Result |
|---|---|
| Regression: ML service tests | ✅ 35 passed, ⚠️ 2 skipped (parity fixture missing) |
| Regression: frontend type check + production build | ✅ pass |
| Smoke: ML service endpoints and security | ✅ 10/10 as expected |
| Smoke: web app compiles in the dev server | ✅ all changed modules compile |
| Smoke: live database has every migration | ✅ all applied; anonymous access blocked |
| E2E (code-path walkthrough of the 4 main flows) | ⚠️ 3 logic bugs, 5 UX issues, 4 risks |
| E2E in a real browser with logged-in users | ❌ not run (needs test accounts; see "Not tested") |

**Highest-priority fixes:** bugs B1 to B3. Learners and tutors silently miss notifications, and tutors can't see students who haven't recorded yet.

---

## 1. Regression

| Check | Command | Result |
|---|---|---|
| Admin + API tests | `pytest tests/test_admin.py tests/test_api.py` | 28 passed |
| Feature extraction tests | `pytest tests/test_features.py` | 7 passed, 2 skipped |
| TypeScript | `npx tsc --noEmit` | no errors |
| Production build | `npx vite build` | builds; warning: main bundle > 500 kB |
| Formatting | `npx oxfmt --check src` | 42 files not formatted (cosmetic) |

**Skipped tests (R1, important for the research):** `test_features.py:98` and `:109` are skipped because the Colab parity fixture (`parity.csv`) was never exported. Nothing currently proves that `acoustic.py` produces the same 40 features as the notebook that trained the model. A mismatch would silently skew every score.

**First test run failed with `WinError 1450 Insufficient system resources`.** Only 0.7 GB of RAM was free while the ML service (Whisper), Vite and the IDE were running. A hung earlier test run was holding memory, and the tests passed once it was stopped. See risk K4.

## 2. Smoke

| Request | Expected | Got |
|---|---|---|
| `GET /health` | 200, model loaded | ✅ 200, `kezspeak-xgb-audio-v1`, 40 features |
| `POST /evaluate`, no key / wrong key | rejected | ✅ 403 both |
| `POST /submissions/{id}/process`, no / bad token | 401 | ✅ 401 both |
| `GET /admin/users`, no token | 401 | ✅ 401 |
| `POST /submissions/{id}/ai-comparison`, no token | 401 | ✅ 401 |
| CORS preflight from an unknown site | blocked | ✅ 400 "Disallowed CORS origin" |
| Web app `/` and changed modules (`App`, `Classwork`, `Statistics`, `MyAssignments`, `UserManagement`, `classroom`) | compile | ✅ 200 |
| Live DB: `tutor_learners`, `assignments.grade`, `kez_list_people`, `kez_mark_missing_assignments`, `kez_set_learner_tutor`, notifications, AI tables | present | ✅ all present |
| Live DB: anonymous read of profiles / notifications / RPCs | denied or empty | ✅ denied/empty |

## 3. End-to-end flows (walked through the code and SQL)

Flows checked: **Administrator** creates accounts → sets a tutor → **Tutor** creates an assignment → **Student** records → ML scores it → tutor reviews and grades → deadline → statistics.

### Bugs

**B1. Learners get no "new feedback" notification for practice recordings or admin-owned work.** `supabase/notifications.sql`, `notify_published_feedback()`
The trigger only fires when an `assignments` row exists for that task with `tutor_id` = the feedback author *and* that author is a `tutor`. Feedback on a practice recording (no assignment), or from an Administrator/Staff, never notifies the learner.
*Fix:* find the learner from `submissions.learner_id`, and check the author is the learner's tutor (`tutor_learners`) or an admin.

**B2. Tutors aren't told about new recordings unless the task was formally assigned to a `tutor`.** `notify_tutor_submission()`
The recipients come from `assignments` joined to `role = 'tutor'`. Practice recordings never notify anyone, and recordings for admin-owned assignments (students with no tutor) never reach the admin.
*Fix:* notify the learner's tutor from `tutor_learners`, plus the assignment owner when it's an admin.

**B3. Students who haven't recorded anything are invisible to tutors.** `tutor/LearnerOverview.tsx`, `tutor/TutorDashboard.tsx`, `lib/progress.ts summarizeLearners()`
Both pages build the learner list from `submissions`. A new student set to a tutor under Users doesn't show on Learners or the Dashboard until their first recording, which looks like the tutor setup failed.
*Fix:* build the list from `listPeople()` (roster), then merge in submission data. Show "Not assessed yet" for students with no recordings. The filter for that status already exists.

### Logic issues / risks

**L1. Announcements from a tutor reach only students who have an assignment with them.** `notify_published_announcement()` uses `assignments`, not the roster. A tutor whose students have no assignments yet reaches nobody. *Fix:* use `tutor_learners`.

**L2. Students can take the post-assessment at any time.** The recorder's task dropdown (`student/RecordActivity.tsx`) and the catalog list every task, including `pre` and `post`. A learner can record "post" on day 1, and the pre/post comparison will use it. For the research, pre/post should only be available when a tutor assigns it.

**L3. The pre/post comparison uses the *latest* pre-assessment.** (`lib/assessments.ts comparePrePost` → `latestCompleted(…, "pre")`). If a learner re-records the pre after the post, the baseline moves. The baseline should be the *first* completed pre (or the one linked to the pre assignment).

**L4. Tutors can edit or delete any task, including the standardized pre/post tasks.** The `tasks_write` RLS allows every tutor to write any row. Editing a pre/post prompt mid-study breaks the "same prompt shape for a fair comparison" rule. *Suggest:* tutors edit only tasks they created (`created_by = auth.uid()`); only Administrators edit pre/post. Also `TaskManagement` doesn't set `created_by`.

**L5. A task can only be assigned to a student once, ever.** `unique (task_id, learner_id)` on `assignments`. Re-assigning the same practice task next month is silently "skipped". This is fine for pre/post, but limiting for practice. *Decide:* allow repeats for `practice` (drop the unique constraint, or include `due_at` in it).

**L6. Removing an assignment deletes its grade without warning.** The confirm dialog in Classwork doesn't mention that the grade is lost, or that the recording becomes ungraded practice.

### UX issues

**U1. The grade box can miss the machine suggestion.** In `LearnerRow` (Classwork), the grade is pre-filled only once, when the row first appears. If recordings finish loading after that, the box stays empty.

**U2. The due-date picker accepts past dates until you press Assign.** Add `min` to the `datetime-local` input so past dates can't be picked.

**U3. Staff (the `admin` role) can't set tutors.** The Users page is Administrator-only because it goes through ml-service `/admin/users`, and the Classwork checklist gives Staff no link for step 2. This is fine if Kez only uses Administrators. Otherwise, show Staff a read-only note.

**U4. As more tutors are added, the Administrator's Classwork list gets long.** Admins see every tutor's cards with no tutor filter. Add a "Tutor: all / …" filter once there are more than one or two tutors.

**U5. Low-confidence score shown without context on some pages.** The Statistics page explains that the machine score isn't validated, but the student's Results page shows the pre/post change prominently in green. Given R² ≈ 0, add the same "machine-generated estimate, reviewed by your tutor" caption there.

### Other findings

**K1. Database migrations aren't in git.** `.gitignore` line 36 ignores `supabase/migrations/`. Teammates cloning the repo get no schema, and `notifications.sql` lives outside the migrations folder, so the apply order isn't obvious. *Fix:* un-ignore the folder and move `notifications.sql` into it with a dated name.

**K2. The model pickle was saved with an older XGBoost version.** It still loads, but XGBoost warns that scores can differ across versions. Re-export it with `Booster.save_model()` (JSON) in Colab and load that instead.

**K3. There are no frontend tests at all.** Every check in this report was manual or static. A few Vitest tests for `lib/classroom.ts` (`classworkState`, `displayGrade`) and `lib/progress.ts` would catch regressions cheaply.

**K4. The laptop is near its memory limit.** With Whisper loaded, about 0.7 GB of 7.7 GB was free. Close unused apps while testing, keep `ENABLE_GRAMMAR=false`, and consider `WHISPER_MODEL=base` for local development if it's configurable.

## 4. Not tested

- **Real browser E2E with logged-in users** (record audio → ML → grade → notifications). It needs one test Administrator, Tutor and Student account and writes real rows to the live Supabase project. With test accounts (or a separate Supabase project) this can be scripted with Playwright.
- Email delivery (invites and password resets): needs custom SMTP.
- Gemini AI feedback / AI comparison: these call a paid external API.
- Performance targets (upload ≤ 15 s, end to end ≤ 60 s): need a real recording on the target network.

## 5. Fix progress (updated 28 Oct 2026)

**New bug found while testing the fixes. B0 (critical): no account could be created.** Two triggers on `auth.users` both inserted the new profile. `kez_on_auth_user_created` (repo) ran first, then the older `on_auth_user_created` → `handle_new_user` (not in the repo, no conflict handling) hit a duplicate key. That rolled back every sign-up, invite and Users-page "Create account" with "Database error creating new user". **Fixed** by `20261031b_fix_signup.sql`, which drops the old trigger. Verified: admin-API account creation works again.

**Live E2E run** with two temporary accounts (created with the service role, then deleted with all their data): **12/12 relevant checks pass.**
- Step 1, B2: a practice recording notifies the tutor. ✅
- Step 1, B1: feedback on a practice recording notifies the student. ✅
- Step 2, B3: a student set to a tutor appears in the tutor's people list before recording, and is hidden before being linked. ✅
- Access: a tutor can't change tutors; the student can't read the tutor's notifications; the tutor sees the student's recording through the roster. ✅
- **L1 doesn't apply:** publishing announcements is admin-only by design. The UI (`AnnouncementsPage` `canPublish`) and a live policy `announcements_create_admin` both enforce this, so a tutor announcement can't happen. The trigger fix is still correct for when that changes. Admin announcements weren't tested live because they'd notify every real student.
- **Drift:** the live policy `announcements_create_admin` isn't in the repo (`notifications.sql` defines a tutor-allowing `announcements_create_staff`). Add the live policy to a migration so the repo matches production.

**Step 3: research guards** (`20261101_research_guards.sql` + app changes). Live E2E with temporary accounts: **14/14 pass.**
- L4: a tutor can create and edit their own practice task, but can't create a pre task or edit the standardized pre task. ✅
- L2: an unassigned pre recording is refused ("must be assigned by your tutor"). An assigned one is accepted, linked to its assignment, and marked turned in. ✅
- L5: a second pre assignment is refused. A second *open* practice copy is refused. Practice can be re-assigned after grading. ✅
- L3 (first pre = baseline) is frontend logic. It gets unit tests in Step 5.
- Regression: the Step 1 + 2 suite re-run afterwards still passes 12/12.

**Step 4: Classwork and Results polish** (app only, no migration). Type check, build and dev-server compile pass.
- U1: the grade box fills in the machine suggestion once recordings load, unless the tutor has typed a grade.
- U2: both due-date pickers have `min` = now.
- L6: the Remove confirmation states that the grade (if any) is deleted, and whether the recording stays as ungraded practice.
- U5: the student pre/post card says "Machine-generated estimate, reviewed by your tutor. Not an official proficiency level."

**Step 5: tests and repo hygiene.**
- K3: Vitest 5.0.4 (pinned), `npm test`, **23/23 pass** (classwork states and grades, learner summaries including unrecorded students, pre/post with the first pre as baseline). Tests mock Supabase and run offline.
- K1 (changed by team decision): migrations stay private (git-ignored on purpose). `notifications.sql` moved into the private folder as `20261027b_notifications.sql`; SETUP.md §7 lists all migrations in run order.
- Drift fixed: the live admin-only announcement policies (`announcements_create_admin`, `announcements_update_admin`) are recorded in `20261031c_announcement_policy.sql`, copied from production `pg_policies`.

**Extra (user request):** the notification popover lists only unread items; read ones stay on the Notifications page. Added a dark-mode mapping for the unread row background (`bg-blue-50/70`).

**Role regression** (28 Oct 2026, live, 5 temporary accounts, all deleted afterwards): **43/43 pass.**
- Administrator 10/10: manage accounts through ml-service (create without email, change role, delete), can't demote or delete themselves, set tutors, sees everyone, full task control.
- Staff 7/7: no account management (403), can't self-promote, sees everyone, edits pre/post tasks, can own work for students with no tutor without joining a roster.
- Tutor 8/8: no account management, can't self-promote or set tutors, sees only their own student, assigns only to their own student, can't edit pre/post tasks or post announcements.
- Student 18/18: no account management or self-promotion, sees only themselves and their tutor (no tutor email), gets assignment notifications, can't create tasks or assignments or grade, overdue work becomes Missing (0), pre only when assigned, can't see or process another student's recordings or audio files.
- **Finding P1 (privacy, low):** two checks first passed on the duplicate-assignment trigger instead of RLS, so unauthorized users could learn whether a student already had a task. Re-tested with clean inputs: RLS correctly blocks both. Fixed by `20261101b_guard_order.sql`, which makes the guard skip callers who can't assign to that learner. **Verified:** a new P1 check (an unauthorized tutor assigning a task the student already has open) now gets the generic RLS error. Full re-run after the fix: roles **44/44**, Step 3 **14/14**, Steps 1 + 2 **12/12** (plus the 3 admin-only announcement checks that don't apply).

**Still open (Colab, user-side):** R1 export `parity.csv`; K2 re-save the model with `save_model` (JSON).

## 6. Recommended order

1. B1, B2, L1: one SQL migration that makes notifications use the roster.
2. B3: list learners from the roster.
3. K1: track migrations in git.
4. L2 + L3 + L4: protect pre/post data for the research.
5. U1, U2, L6: small Classwork fixes.
6. R1 + K2: export the parity fixture and re-save the model from Colab.

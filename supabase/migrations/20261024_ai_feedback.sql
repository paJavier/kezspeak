-- AI fallback feedback (Gemini), used when the ML pipeline cannot score a recording.
--
-- Kept in its own table on purpose: it is qualitative text only (no score) and
-- must never be mixed into `evaluations` or the pre/post comparison.
-- Written only by the Edge Function (service role). Apply after
-- 20261023_assessment_pipeline.sql. Safe to re-run.

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  provider text not null,
  model text not null,
  transcript text,
  summary text not null,
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ai_feedback enable row level security;

-- Visible to whoever can see the submission (learner, assigned tutor, admin).
drop policy if exists ai_feedback_read on public.ai_feedback;
create policy ai_feedback_read on public.ai_feedback
  for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));

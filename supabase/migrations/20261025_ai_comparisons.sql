-- Research comparison: the trained model's score vs. a Gemini estimate on the
-- same recording, requested by a tutor or admin.
--
-- Kept apart from `evaluations` and `ai_feedback` on purpose:
--   * the Gemini score never feeds tutor scores, final scores or pre/post;
--   * learners cannot read this table at all (tutors/admins only).
-- Written only by ml-service (service role). Apply after
-- 20261023_assessment_pipeline.sql. Safe to re-run.

create table if not exists public.ai_comparisons (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  provider text not null,
  model text not null,
  ai_score numeric(5, 2) check (ai_score between 0 and 100),
  -- Snapshot of the trained model's result at comparison time.
  model_score numeric(5, 2),
  model_version text,
  transcript text,
  summary text not null,
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ai_comparisons enable row level security;

drop policy if exists ai_comparisons_read on public.ai_comparisons;
create policy ai_comparisons_read on public.ai_comparisons
  for select to authenticated
  using (
    public.kez_role() = 'admin'
    or (
      public.kez_role() = 'tutor'
      and exists (
        select 1 from public.submissions s
        where s.id = submission_id and public.kez_tutor_has_learner(s.learner_id)
      )
    )
  );

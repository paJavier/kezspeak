-- KezSpeak assessment pipeline: tasks, assignments, submissions, ML evaluations,
-- tutor feedback, and the private `recordings` storage bucket.
--
-- Apply in the Supabase dashboard -> SQL Editor. Safe to re-run.
-- Assumes public.profiles(id uuid = auth.users.id, role text) already exists.
--
-- Access model (see .claude/agents/kezspeak.md):
--   learner -> own rows only
--   tutor   -> rows of learners they have an assignment with
--   admin   -> everything
--   ML service (service_role key) bypasses RLS and is the only writer of
--   evaluations and submission status.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.kez_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.kez_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prompt text not null,
  skill_focus text,
  kind text not null check (kind in ('pre', 'post', 'practice')),
  duration_seconds int not null default 60 check (duration_seconds between 10 and 300),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.assessment_tasks(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  due_at timestamptz,
  status text not null default 'assigned' check (status in ('assigned', 'submitted', 'reviewed')),
  created_at timestamptz not null default now(),
  unique (task_id, learner_id)
);

-- Defined after `assignments` exists: SQL function bodies are validated at
-- creation time, so it cannot reference a table that is created later.
create or replace function public.kez_tutor_has_learner(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignments
    where tutor_id = auth.uid() and learner_id = p_learner
  )
$$;

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.assessment_tasks(id) on delete restrict,
  assignment_id uuid references public.assignments(id) on delete set null,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  audio_path text not null,
  mime_type text not null,
  duration_seconds numeric,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'transcribing', 'extracting_features', 'evaluating', 'completed', 'failed')
  ),
  error text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_learner_idx on public.submissions (learner_id, submitted_at desc);

drop trigger if exists submissions_updated_at on public.submissions;
create trigger submissions_updated_at
  before update on public.submissions
  for each row execute function public.kez_set_updated_at();

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  transcript text not null,
  acoustic_features jsonb not null,
  nlp_features jsonb not null,
  predicted_score numeric not null check (predicted_score between 0 and 100),
  model_version text not null,
  feature_version text not null,
  processing_ms int,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  comment text not null,
  strengths text,
  improvements text,
  adjusted_score numeric check (adjusted_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tutor_feedback_updated_at on public.tutor_feedback;
create trigger tutor_feedback_updated_at
  before update on public.tutor_feedback
  for each row execute function public.kez_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.assessment_tasks enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.evaluations enable row level security;
alter table public.tutor_feedback enable row level security;

-- assessment_tasks: everyone signed in can read; tutors/admins manage.
drop policy if exists tasks_read on public.assessment_tasks;
create policy tasks_read on public.assessment_tasks
  for select to authenticated using (true);

drop policy if exists tasks_write on public.assessment_tasks;
create policy tasks_write on public.assessment_tasks
  for all to authenticated
  using (public.kez_role() in ('tutor', 'admin'))
  with check (public.kez_role() in ('tutor', 'admin'));

-- assignments
drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments
  for select to authenticated
  using (learner_id = auth.uid() or tutor_id = auth.uid() or public.kez_role() = 'admin');

drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments
  for all to authenticated
  using ((tutor_id = auth.uid() and public.kez_role() = 'tutor') or public.kez_role() = 'admin')
  with check ((tutor_id = auth.uid() and public.kez_role() = 'tutor') or public.kez_role() = 'admin');

-- submissions: learners insert their own pending rows; status is service-only.
drop policy if exists submissions_read on public.submissions;
create policy submissions_read on public.submissions
  for select to authenticated
  using (
    learner_id = auth.uid()
    or public.kez_tutor_has_learner(learner_id)
    or public.kez_role() = 'admin'
  );

drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert to authenticated
  with check (
    learner_id = auth.uid()
    and status = 'pending'
    and audio_path like auth.uid()::text || '/%'
  );

-- evaluations: read-only for users; written by the ML service.
drop policy if exists evaluations_read on public.evaluations;
create policy evaluations_read on public.evaluations
  for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));

-- tutor_feedback: visible with the submission; tutors write their own.
drop policy if exists feedback_read on public.tutor_feedback;
create policy feedback_read on public.tutor_feedback
  for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));

drop policy if exists feedback_write on public.tutor_feedback;
create policy feedback_write on public.tutor_feedback
  for all to authenticated
  using (tutor_id = auth.uid() and public.kez_role() in ('tutor', 'admin'))
  with check (
    tutor_id = auth.uid()
    and public.kez_role() in ('tutor', 'admin')
    and exists (select 1 from public.submissions s where s.id = submission_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files at recordings/{learner_id}/{submission_id}.webm
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 10485760,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
on conflict (id) do nothing;

drop policy if exists recordings_insert on storage.objects;
create policy recordings_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists recordings_read on storage.objects;
create policy recordings_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recordings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.kez_tutor_has_learner(((storage.foldername(name))[1])::uuid)
      or public.kez_role() = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: standardized tasks (same prompt shape for pre and post so the
-- comparison is fair).
-- ---------------------------------------------------------------------------

insert into public.assessment_tasks (title, prompt, skill_focus, kind, duration_seconds)
select * from (values
  ('Describe Your Favorite Place',
   'Speak for 60 seconds about your favorite place. Describe what it looks like, what you do there, and why you like it.',
   'Fluency + Vocabulary', 'pre', 60),
  ('Describe a Memorable Day',
   'Speak for 60 seconds about a memorable day. Describe where you were, what happened, and why you remember it.',
   'Fluency + Vocabulary', 'post', 60),
  ('Describe Your Weekend',
   'Speak for 60 seconds about what you did last weekend. Try to explain what you enjoyed and why.',
   'Fluency', 'practice', 60)
) as t(title, prompt, skill_focus, kind, duration_seconds)
where not exists (select 1 from public.assessment_tasks);

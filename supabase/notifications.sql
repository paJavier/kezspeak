-- Apply after the existing private KezSpeak migrations in the Supabase SQL editor.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('announcement','assessment_available','review_required','score_released','feedback_published','access_request','admin_request')),
  title text not null,
  body text not null,
  related_id uuid,
  destination text not null check (destination in ('activities','assessment','results','feedback','review','announcements','notifications','assignments','users','tasks','learners','profile')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dedupe_key text not null,
  unique (user_id, dedupe_key)
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
drop policy if exists notifications_authenticated_select on public.notifications;
create policy notifications_authenticated_select on public.notifications as permissive for select to authenticated using (true);
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications as restrictive for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_authenticated_update on public.notifications;
create policy notifications_authenticated_update on public.notifications as permissive for update to authenticated using (true) with check (true);
drop policy if exists notifications_mark_own_read on public.notifications;
create policy notifications_mark_own_read on public.notifications as restrictive for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists announcements_published_idx on public.announcements(published_at desc) where published_at is not null;

create table if not exists public.announcement_recipients (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  primary key (announcement_id, user_id)
);
alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
revoke all on public.announcements from public, anon, authenticated;
revoke all on public.announcement_recipients from public, anon, authenticated;
grant select on public.announcements to authenticated;
grant insert (author_id, title, body, published_at) on public.announcements to authenticated;
grant update (title, body, published_at) on public.announcements to authenticated;
grant select on public.announcement_recipients to authenticated;
grant update (read_at) on public.announcement_recipients to authenticated;

-- Avoid recursive RLS: announcement visibility reads recipient rows, and recipient
-- visibility must also check whether its announcement has been published.
create or replace function public.is_published_announcement_for_current_user(p_announcement_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select exists (
    select 1 from public.announcements a
    join public.announcement_recipients r on r.announcement_id = a.id
    where a.id = p_announcement_id and a.published_at is not null and r.user_id = auth.uid()
  );
$$;
revoke all on function public.is_published_announcement_for_current_user(uuid) from public, anon, authenticated;
grant execute on function public.is_published_announcement_for_current_user(uuid) to authenticated;

-- An announcement can be unpublished after delivery; hide its copied notification
-- content from recipients as well as hiding the announcement and recipient rows.
drop policy if exists notifications_announcement_published on public.notifications;
create policy notifications_announcement_published on public.notifications as restrictive for select to authenticated using (
  type <> 'announcement'
  or (
    related_id is not null
    and public.is_published_announcement_for_current_user(related_id)
  )
);

drop policy if exists announcements_authenticated_select on public.announcements;
create policy announcements_authenticated_select on public.announcements as permissive for select to authenticated using (true);
drop policy if exists announcements_read_authorized on public.announcements;
create policy announcements_read_authorized on public.announcements as restrictive for select to authenticated using (
  (author_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('tutor','admin','super_admin')))
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','super_admin'))
  or (published_at is not null and exists (select 1 from public.announcement_recipients r where r.announcement_id = announcements.id and r.user_id = auth.uid()))
);
drop policy if exists announcements_authenticated_insert on public.announcements;
create policy announcements_authenticated_insert on public.announcements as permissive for insert to authenticated with check (true);
drop policy if exists announcements_create_staff on public.announcements;
create policy announcements_create_staff on public.announcements as restrictive for insert to authenticated with check (
  author_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('tutor','admin','super_admin'))
);
drop policy if exists announcements_authenticated_update on public.announcements;
create policy announcements_authenticated_update on public.announcements as permissive for update to authenticated using (true) with check (true);
drop policy if exists announcements_update_author on public.announcements;
create policy announcements_update_author on public.announcements as restrictive for update to authenticated using (
  author_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('tutor','admin','super_admin'))
)
with check (
  author_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('tutor','admin','super_admin'))
);
drop policy if exists announcement_recipients_authenticated_select on public.announcement_recipients;
create policy announcement_recipients_authenticated_select on public.announcement_recipients as permissive for select to authenticated using (true);
drop policy if exists announcement_recipients_read_own on public.announcement_recipients;
create policy announcement_recipients_read_own on public.announcement_recipients as restrictive for select to authenticated using (
  user_id = auth.uid() and public.is_published_announcement_for_current_user(announcement_id)
);
drop policy if exists announcement_recipients_authenticated_update on public.announcement_recipients;
create policy announcement_recipients_authenticated_update on public.announcement_recipients as permissive for update to authenticated using (true) with check (true);
drop policy if exists announcement_recipients_mark_own_read on public.announcement_recipients;
create policy announcement_recipients_mark_own_read on public.announcement_recipients as restrictive for update to authenticated using (
  user_id = auth.uid() and public.is_published_announcement_for_current_user(announcement_id)
) with check (
  user_id = auth.uid() and public.is_published_announcement_for_current_user(announcement_id)
);

create or replace function public.insert_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_related_id uuid, p_destination text, p_dedupe_key text)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  insert into public.notifications(user_id,type,title,body,related_id,destination,dedupe_key)
  values (p_user_id,p_type,p_title,p_body,p_related_id,p_destination,p_dedupe_key)
  on conflict (user_id,dedupe_key) do nothing;
end;
$$;
revoke all on function public.insert_notification(uuid,text,text,text,uuid,text,text) from public, anon, authenticated;

create or replace function public.notify_new_assessment_task()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  -- No task availability/publication field is established by the repository schema.
  return new;
end;
$$;
revoke all on function public.notify_new_assessment_task() from public, anon, authenticated;

create or replace function public.notify_new_assignment()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare task_title text;
begin
  if auth.uid() is not null and not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')) then return new; end if;
  if not exists (select 1 from public.profiles p where p.id = new.learner_id and p.role = 'student') then return new; end if;
  select t.title into task_title from public.assessment_tasks t where t.id=new.task_id;
  perform public.insert_notification(new.learner_id,'assessment_available','A speaking task was assigned to you',coalesce(task_title,'A speaking task')||' is ready in Speaking Activities.',new.task_id,'activities','assessment-assignment:'||new.id::text);
  return new;
end;
$$;
revoke all on function public.notify_new_assignment() from public, anon, authenticated;

create or replace function public.notify_tutor_submission()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare recipient record; task_title text;
begin
  if auth.uid() is not null and auth.uid() <> new.learner_id then return new; end if;
  select t.title into task_title from public.assessment_tasks t where t.id=new.task_id;
  for recipient in
    select distinct a.tutor_id from public.assignments a join public.profiles p on p.id=a.tutor_id and p.role='tutor'
    where a.learner_id=new.learner_id and a.task_id=new.task_id
  loop
    perform public.insert_notification(recipient.tutor_id,'review_required','Assessment submitted for review',coalesce(task_title,'A speaking task')||' has a new student submission.',new.id,'review','submission-review:'||new.id::text);
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_tutor_submission() from public, anon, authenticated;

create or replace function public.notify_released_score()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare task_title text;
begin
  if new.status <> 'completed' or old.status = 'completed' then return new; end if;
  if auth.uid() is not null and not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')) then return new; end if;
  if not exists (select 1 from public.profiles p where p.id = new.learner_id and p.role = 'student') then return new; end if;
  if not exists (select 1 from public.evaluations e where e.submission_id=new.id) then return new; end if;
  -- The old/new status transition is the only established event identity. It
  -- deduplicates retries of the same transition; no release version is available.
  select t.title into task_title from public.assessment_tasks t where t.id=new.task_id;
  perform public.insert_notification(new.learner_id,'score_released','Your assessment result is ready',coalesce(task_title,'Your assessment')||' has results to view.',new.id,'results','score:'||new.id::text||':'||coalesce(old.status,'')||':completed');
  return new;
end;
$$;
revoke all on function public.notify_released_score() from public, anon, authenticated;

create or replace function public.notify_published_feedback()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare learner uuid;
begin
  if length(btrim(coalesce(new.comment,'')))=0 then return new; end if;
  if auth.uid() is not null and auth.uid() <> new.tutor_id and not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')) then return new; end if;
  select s.learner_id into learner
  from public.submissions s
  join public.assignments a on a.learner_id = s.learner_id and a.task_id = s.task_id and a.tutor_id = new.tutor_id
  join public.profiles p on p.id = a.tutor_id and p.role = 'tutor'
  join public.profiles student on student.id = s.learner_id and student.role = 'student'
  where s.id = new.submission_id;
  if learner is not null then
    -- Comment content plus tutor distinguishes edits and retries. Identical
    -- re-publications cannot be distinguished without a feedback event/version key.
    perform public.insert_notification(learner,'feedback_published','New tutor feedback','Your tutor shared feedback on a speaking assessment.',new.submission_id,'feedback','feedback:'||new.submission_id::text||':'||new.tutor_id::text||':'||md5(btrim(new.comment)));
  end if;
  return new;
end;
$$;
revoke all on function public.notify_published_feedback() from public, anon, authenticated;

create or replace function public.notify_published_announcement()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare author_role text;
begin
  if new.published_at is null or (tg_op='UPDATE' and old.published_at is not null) then return new; end if;
  select p.role into author_role from public.profiles p where p.id=new.author_id;
  if author_role not in ('tutor','admin','super_admin') then return new; end if;
  if auth.uid() is not null and auth.uid() <> new.author_id then return new; end if;

  insert into public.announcement_recipients(announcement_id,user_id)
  select new.id,s.id from public.profiles s where s.role='student' and (
    author_role in ('admin','super_admin')
    or exists (select 1 from public.assignments a where a.tutor_id=new.author_id and a.learner_id=s.id)
  ) on conflict (announcement_id,user_id) do nothing;

  insert into public.notifications(user_id,type,title,body,related_id,destination,dedupe_key)
  select r.user_id,'announcement',new.title,left(new.body,240),new.id,'announcements','announcement:'||new.id::text
  from public.announcement_recipients r where r.announcement_id=new.id
  on conflict (user_id,dedupe_key) do nothing;
  return new;
end;
$$;
revoke all on function public.notify_published_announcement() from public, anon, authenticated;

-- Keep the announcement's own read marker and its notification read marker in sync.
create or replace function public.sync_announcement_read_state()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if tg_table_name = 'notifications' then
    if new.type = 'announcement' and new.related_id is not null and new.read_at is distinct from old.read_at then
      update public.announcement_recipients set read_at = new.read_at
      where announcement_id = new.related_id and user_id = new.user_id;
    end if;
  elsif new.read_at is distinct from old.read_at then
    update public.notifications set read_at = new.read_at
    where type = 'announcement' and related_id = new.announcement_id and user_id = new.user_id
      and read_at is distinct from new.read_at;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_announcement_read_state() from public, anon, authenticated;

-- Task publication/availability is not represented in the schema information
-- available in this repository. Remove any prior insert trigger and do not
-- re-enable until the live task availability field/event is verified. If restored,
-- use assessment-task:<task-id>; assignments use assessment-assignment:<assignment-id>.
drop trigger if exists assessment_task_notification on public.assessment_tasks;
drop trigger if exists assignment_notification on public.assignments;
create trigger assignment_notification after insert on public.assignments for each row execute function public.notify_new_assignment();
drop trigger if exists submission_review_notification on public.submissions;
create trigger submission_review_notification after insert on public.submissions for each row execute function public.notify_tutor_submission();
drop trigger if exists score_release_notification on public.submissions;
create trigger score_release_notification after update of status on public.submissions for each row execute function public.notify_released_score();
drop trigger if exists feedback_published_notification on public.tutor_feedback;
create trigger feedback_published_notification after insert or update of comment on public.tutor_feedback for each row execute function public.notify_published_feedback();
drop trigger if exists announcement_published_notification_insert on public.announcements;
create trigger announcement_published_notification_insert after insert on public.announcements for each row execute function public.notify_published_announcement();
drop trigger if exists announcement_published_notification_update on public.announcements;
create trigger announcement_published_notification_update after update of published_at on public.announcements for each row execute function public.notify_published_announcement();
drop trigger if exists notification_announcement_read_sync on public.notifications;
create trigger notification_announcement_read_sync after update of read_at on public.notifications for each row execute function public.sync_announcement_read_state();
drop trigger if exists announcement_read_notification_sync on public.announcement_recipients;
create trigger announcement_read_notification_sync after update of read_at on public.announcement_recipients for each row execute function public.sync_announcement_read_state();

revoke all on function public.insert_notification(uuid,text,text,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.notify_new_assessment_task() from public,anon,authenticated;
revoke all on function public.notify_new_assignment() from public,anon,authenticated;
revoke all on function public.notify_tutor_submission() from public,anon,authenticated;
revoke all on function public.notify_released_score() from public,anon,authenticated;
revoke all on function public.notify_published_feedback() from public,anon,authenticated;
revoke all on function public.notify_published_announcement() from public,anon,authenticated;
revoke all on function public.sync_announcement_read_state() from public,anon,authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

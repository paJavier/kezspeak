-- Super admin: manages user accounts and roles (via ml-service /admin routes,
-- which use the service-role key), plus tasks and assignments (via RLS).
-- Apply after 20261023_assessment_pipeline.sql. Safe to re-run.

-- 1. Allow the new role. Drops whatever role check already exists on profiles.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'tutor', 'admin', 'super_admin'));

-- 2. RLS: a super admin has every admin permission. Existing policies compare
-- kez_role() to 'admin', so report super_admin as 'admin' here. Code that
-- needs the real role (the super-admin screens) reads profiles.role directly.
create or replace function public.kez_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case role when 'super_admin' then 'admin' else role end
  from public.profiles where id = auth.uid()
$$;

-- 3. Only the server (service role) or the SQL editor may set roles. Signed-in
-- users can't promote themselves, and public sign-ups always start as student.
create or replace function public.kez_guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.role := 'student';
    elsif new.role is distinct from old.role then
      raise exception 'Only a super admin can change roles.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before insert or update on public.profiles
  for each row execute function public.kez_guard_profile_role();

-- 4. Bootstrap: make your own account the first super admin (edit the email).
-- update public.profiles set role = 'super_admin' where email = 'you@example.com';

-- Run once in the Supabase SQL editor. All data is server-only; no public policies.
create table if not exists public.slotcare_watches (
 id uuid primary key default gen_random_uuid(), runner_id text not null,
 preferences jsonb not null, interval_seconds integer not null check(interval_seconds between 60 and 3600),
 starts_at timestamptz not null, expires_at timestamptz not null, next_check timestamptz not null,
 enabled boolean not null default true, status text not null default 'waiting',
 last_checked timestamptz, last_result jsonb, created_at timestamptz not null default now()
);
create table if not exists public.slotcare_jobs (
 id uuid primary key default gen_random_uuid(), watch_id uuid not null references public.slotcare_watches(id) on delete cascade,
 state text not null default 'queued' check(state in ('queued','claimed','done')),
 lease_token uuid, lease_until timestamptz, created_at timestamptz not null default now(), result jsonb
);
create unique index if not exists slotcare_one_open_job on public.slotcare_jobs(watch_id) where state in ('queued','claimed');
alter table public.slotcare_watches enable row level security;
alter table public.slotcare_jobs enable row level security;
revoke all on public.slotcare_watches,public.slotcare_jobs from anon,authenticated;
grant all on public.slotcare_watches,public.slotcare_jobs to service_role;

create or replace function public.slotcare_enqueue_due() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare w record; n integer:=0;
begin
 update slotcare_watches set enabled=false,status='expired' where enabled and expires_at<=now();
 update slotcare_jobs j set state='done',result='{"status":"cancelled"}'::jsonb from slotcare_watches w where j.watch_id=w.id and not w.enabled and j.state in ('queued','claimed');
 update slotcare_jobs set state='queued',lease_token=null,lease_until=null where state='claimed' and lease_until<now();
 for w in select * from slotcare_watches where enabled and starts_at<=now() and next_check<=now() and expires_at>now() order by next_check limit 100 for update skip locked loop
  insert into slotcare_jobs(watch_id) values(w.id) on conflict do nothing;
  if found then n:=n+1;update slotcare_watches set status='queued',next_check=now()+make_interval(secs=>w.interval_seconds) where id=w.id;end if;
 end loop;return n;
end $$;
create or replace function public.slotcare_claim_jobs(p_runner_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j record; token uuid; output jsonb:='[]'::jsonb;
begin
 for j in select jobs.id,jobs.watch_id,w.preferences from slotcare_jobs jobs join slotcare_watches w on w.id=jobs.watch_id where jobs.state='queued' and w.enabled and w.expires_at>now() and w.runner_id=p_runner_id order by jobs.created_at limit 1 for update of jobs skip locked loop
  token:=gen_random_uuid();update slotcare_jobs set state='claimed',lease_token=token,lease_until=now()+interval '90 seconds' where id=j.id;
  update slotcare_watches set status='checking' where id=j.watch_id;
  output:=output||jsonb_build_array(jsonb_build_object('id',j.id,'watch_id',j.watch_id,'preferences',j.preferences,'lease_token',token));
 end loop;return output;
end $$;
create or replace function public.slotcare_finish_job(p_job_id uuid,p_lease_token uuid,p_result jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid;
begin
 select watch_id into target from slotcare_jobs where id=p_job_id and state='claimed' and lease_token=p_lease_token and lease_until>now() for update;
 if not found then return false;end if;
 update slotcare_jobs set state='done',result=p_result where id=p_job_id;
 update slotcare_watches set last_checked=now(),last_result=p_result,status=case when not enabled then status else p_result->>'status' end,enabled=enabled and (p_result->>'status')='unavailable' where id=target;
 return true;
end $$;
revoke all on function public.slotcare_enqueue_due(),public.slotcare_claim_jobs(text),public.slotcare_finish_job(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.slotcare_enqueue_due(),public.slotcare_claim_jobs(text),public.slotcare_finish_job(uuid,uuid,jsonb) to service_role;

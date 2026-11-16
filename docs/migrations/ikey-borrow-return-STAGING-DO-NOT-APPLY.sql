-- STAGING ONLY. Do not apply to production before reviewing authorization and execution semantics.
-- iBOX project_slot_codes is independent from legacy storage_slots / borrowings.
create table if not exists public.ikey_slot_loans (
 slot_code text primary key references public.project_slot_codes(slot_code),
 project_id text not null,
 borrower_user_id text not null,
 borrowed_at timestamptz not null default now(),
 returned_at timestamptz,
 constraint ikey_slot_loans_valid_time check (returned_at is null or returned_at >= borrowed_at)
);
create table if not exists public.ikey_slot_loan_events (
 request_id uuid primary key,
 slot_code text not null references public.project_slot_codes(slot_code),
 project_id text not null,
 actor_user_id text not null,
 action text not null check (action in ('borrow','return')),
 created_at timestamptz not null default now(),
 result jsonb not null
);
create index if not exists ikey_slot_loan_events_slot_time on public.ikey_slot_loan_events(slot_code,created_at desc);
create unique index if not exists ikey_slot_loans_one_active on public.ikey_slot_loans(slot_code) where returned_at is null;
alter table public.ikey_slot_loans enable row level security;
alter table public.ikey_slot_loan_events enable row level security;
revoke all on public.ikey_slot_loans,public.ikey_slot_loan_events from anon,authenticated;
-- Service-only, transaction-scoped RPC. Application must authenticate the session and authorize the project first.
-- Do not enable this RPC until the device execution-receipt policy is settled.
create or replace function public.ikey_slot_loan_transition(
 p_request_id uuid,p_slot_code text,p_project_id text,p_actor_user_id text,p_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_slot public.project_slot_codes%rowtype; v_loan public.ikey_slot_loans%rowtype; v_event public.ikey_slot_loan_events%rowtype; v_result jsonb;
begin
 if p_action not in ('borrow','return') or p_actor_user_id is null or length(trim(p_actor_user_id))=0 then
  raise exception 'INVALID_INPUT';
 end if;
 select * into v_slot from public.project_slot_codes where slot_code=p_slot_code and project_id=p_project_id and is_active=true for update;
 if not found then raise exception 'SLOT_NOT_FOUND'; end if;
 select * into v_event from public.ikey_slot_loan_events where request_id=p_request_id;
 if found then
  if v_event.slot_code<>p_slot_code or v_event.project_id<>p_project_id or v_event.actor_user_id<>p_actor_user_id or v_event.action<>p_action then
   raise exception 'IDEMPOTENCY_CONFLICT';
  end if;
  return v_event.result;
 end if;
 select * into v_loan from public.ikey_slot_loans where slot_code=p_slot_code for update;
 if p_action='borrow' then
  if found and v_loan.returned_at is null then raise exception 'SLOT_NOT_AVAILABLE'; end if;
  insert into public.ikey_slot_loans(slot_code,project_id,borrower_user_id,borrowed_at,returned_at)
   values(p_slot_code,p_project_id,p_actor_user_id,now(),null)
   on conflict(slot_code) do update set project_id=excluded.project_id,borrower_user_id=excluded.borrower_user_id,borrowed_at=excluded.borrowed_at,returned_at=null;
 else
  if not found or v_loan.returned_at is not null then raise exception 'SLOT_NOT_BORROWED'; end if;
  if v_loan.borrower_user_id<>p_actor_user_id then raise exception 'NOT_BORROWER'; end if;
  update public.ikey_slot_loans set returned_at=now() where slot_code=p_slot_code;
 end if;
 v_result=jsonb_build_object('success',true,'request_id',p_request_id,'slot_code',p_slot_code,'project_id',p_project_id,'action',p_action,'physical_unlock_sent',false);
 insert into public.ikey_slot_loan_events(request_id,slot_code,project_id,actor_user_id,action,result)
 values(p_request_id,p_slot_code,p_project_id,p_actor_user_id,p_action,v_result);
 return v_result;
end $$;
revoke all on function public.ikey_slot_loan_transition(uuid,text,text,text,text) from public,anon,authenticated;
-- Explicit service_role grant is intentionally withheld until full review.

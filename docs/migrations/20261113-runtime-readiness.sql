create or replace function public.ikey_resolve_session(p_hash text) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('session',to_jsonb(s),'user',to_jsonb(u)) from public.auth_sessions s join public.gen3_users u using(user_id) where s.session_token_hash=p_hash and coalesce(s.revoked_at::text,'')='' and s.expires_at::timestamptz>now() limit 1
$$;
create or replace function public.ikey_auth_ready() returns boolean language sql stable security invoker set search_path='' as $$
select has_table_privilege(current_user,'public.gen3_users','SELECT') and has_table_privilege(current_user,'public.gen3_users','INSERT') and has_table_privilege(current_user,'public.auth_sessions','SELECT') and (select count(distinct proname)=3 from pg_proc where pronamespace='public'::regnamespace and proname in ('ikey_auth_throttle','ikey_auth_login','ikey_auth_failure') and has_function_privilege(current_user,oid,'EXECUTE'))
$$;
revoke all on function public.ikey_resolve_session(text),public.ikey_auth_ready() from public,anon,authenticated;
grant execute on function public.ikey_resolve_session(text),public.ikey_auth_ready() to service_role;
drop index if exists public.project_devices_unique_project_device;
create index if not exists borrowings_user_idx on public.borrowings(user_id);
create index if not exists borrowings_storage_slot_idx on public.borrowings(storage_slot_id);
-- iKey serial-only command test; no physical actuation.
create table if not exists public.device_test_commands (
 command_id uuid primary key,
 project_id text not null,
 device_id text not null,
 actor_user_id text not null,
 status text not null default 'pending' check(status in ('pending','claimed','completed','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '45 seconds'),
 claimed_at timestamptz,
 completed_at timestamptz
);
create index if not exists device_test_commands_claim_idx on public.device_test_commands(device_id,status,created_at);
alter table public.device_test_commands enable row level security;
revoke all on public.device_test_commands from public,anon,authenticated;
grant select,insert,update on public.device_test_commands to service_role;
create or replace function public.ikey_serial_test_claim(p_device_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.device_test_commands;
begin
 update public.device_test_commands set status='expired'
 where device_id=p_device_id and status in ('pending','claimed') and expires_at<=now();
 update public.device_test_commands set status='claimed',claimed_at=now()
 where command_id=(
  select command_id from public.device_test_commands
  where device_id=p_device_id and status='pending' and expires_at>now()
  order by created_at,command_id for update skip locked limit 1
 ) returning * into v;
 if not found then return jsonb_build_object('success',true,'command',null); end if;
 return jsonb_build_object('success',true,'command',jsonb_build_object('command_id',v.command_id,'action','SERIAL_TEST_UNLOCK'));
end $$;
create or replace function public.ikey_serial_test_complete(p_device_id text,p_command_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 update public.device_test_commands set status='completed',completed_at=now()
 where command_id=p_command_id and device_id=p_device_id and status='claimed' and expires_at>now();
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function public.ikey_serial_test_claim(text),public.ikey_serial_test_complete(text,uuid) from public,anon,authenticated;
grant execute on function public.ikey_serial_test_claim(text),public.ikey_serial_test_complete(text,uuid) to service_role;

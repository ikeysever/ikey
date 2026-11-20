-- Staging migration: apply only after review, before enabling heartbeat API.
create table if not exists public.device_heartbeats (
 device_id text primary key references public.devices(device_id) on delete cascade,
 last_seen_at timestamptz not null default now()
);
alter table public.device_heartbeats enable row level security;
revoke all on public.device_heartbeats from anon, authenticated;
-- Server-side secret-key adapter only; never expose this table to browser clients.

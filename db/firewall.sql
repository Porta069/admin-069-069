-- Application-Firewall: Ereignis-Log (Edge + Node) und dynamische IP-Regeln.

create table if not exists admin.firewall_event (
  id          uuid primary key default gen_random_uuid(),
  ip          text,
  method      text,
  path        text,
  reason      text not null,
  action      text not null default 'BLOCK',   -- BLOCK | MONITOR | RATE_LIMIT
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists firewall_event_zeit_idx on admin.firewall_event (created_at desc);
create index if not exists firewall_event_ip_idx   on admin.firewall_event (ip, created_at desc);

create table if not exists admin.firewall_rule (
  id          uuid primary key default gen_random_uuid(),
  rule_type   text not null,                    -- BLOCK_IP | ALLOW_IP
  pattern     text not null,                    -- IP oder IP-Präfix (z. B. 203.0.113. )
  note        text,
  enabled     boolean not null default true,
  created_by  uuid references admin.employee(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint firewall_rule_type_chk check (rule_type in ('BLOCK_IP','ALLOW_IP'))
);
create unique index if not exists firewall_rule_uniq
  on admin.firewall_rule (rule_type, pattern) where deleted_at is null;

-- Life dashboard schema. Every statement is idempotent so it can run on every deploy.

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

create table if not exists habits (
  id         serial primary key,
  slug       text unique,
  label      text not null,
  note       text not null default '',
  category   text not null default 'health' check (category in ('health', 'career', 'life')),
  sort       int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists habit_checks (
  habit_id int  not null references habits(id) on delete cascade,
  day      date not null,
  primary key (habit_id, day)
);
create index if not exists habit_checks_day on habit_checks (day);

create table if not exists daily_log (
  day    date primary key,
  water  int  not null default 0 check (water >= 0),
  weight numeric(5,1) check (weight is null or (weight > 50 and weight < 800)),
  note   text
);

create table if not exists workouts (
  id         serial primary key,
  day        date not null,
  kind       text not null,
  minutes    int  check (minutes is null or minutes between 1 and 600),
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists workouts_day on workouts (day);

create table if not exists todos (
  id         serial primary key,
  title      text not null,
  due_on     date,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists applications (
  id           serial primary key,
  company      text not null,
  role         text not null default '',
  link         text not null default '',
  stage        text not null default 'applied'
               check (stage in ('saved', 'applied', 'screen', 'interview', 'offer', 'rejected', 'withdrawn')),
  applied_on   date,
  follow_up_on date,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists applications_applied_on on applications (applied_on);

-- metric decides how progress is measured:
--   weight        start_value -> target (lb); target_change sets target from the first weigh-in
--   job           furthest pipeline stage reached by any open application
--   applications  count of applications with applied_on in [start_date, due_date] vs target
--   workouts      count of workouts in [start_date, due_date] vs target
--   manual        current_manual vs target, updated by hand
create table if not exists goals (
  id             serial primary key,
  title          text not null,
  category       text not null default 'personal' check (category in ('personal', 'career')),
  metric         text not null check (metric in ('weight', 'job', 'applications', 'workouts', 'manual')),
  start_value    numeric,
  target         numeric,
  target_change  numeric,
  current_manual numeric,
  unit           text not null default '',
  start_date     date not null default current_date,
  due_date       date not null,
  done_at        timestamptz,
  created_at     timestamptz not null default now()
);

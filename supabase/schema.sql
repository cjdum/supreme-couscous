-- ─────────────────────────────────────────────────────────────────────────────
-- MODVAULT — Supabase Schema with Row Level Security
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Custom types ─────────────────────────────────────────────────────────────
do $$ begin
  create type mod_category as enum (
    'engine', 'suspension', 'aero', 'interior',
    'wheels', 'exhaust', 'electronics', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mod_status as enum ('installed', 'wishlist');
exception when duplicate_object then null;
end $$;

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  username     text not null,
  display_name text,
  avatar_url   text,
  bio          text check (char_length(bio) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,24}$')
);

-- ── cars ─────────────────────────────────────────────────────────────────────
create table if not exists cars (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  vin             char(17),
  make            text not null check (char_length(make) between 1 and 50),
  model           text not null check (char_length(model) between 1 and 80),
  year            int  not null check (year between 1886 and extract(year from now()) + 1),
  trim            text check (char_length(trim) <= 80),
  color           text check (char_length(color) <= 40),
  nickname        text check (char_length(nickname) <= 60),
  cover_image_url text,
  is_public       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cars_vin_format check (
    vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'
  )
);

-- Case-insensitive unique username index (expression indexes must be a separate CREATE INDEX)
create unique index if not exists profiles_username_lower_idx on profiles(lower(username));

create index if not exists cars_user_id_idx on cars(user_id);
create index if not exists cars_is_public_idx on cars(is_public) where is_public = true;
create index if not exists cars_make_model_idx on cars(make, model);

-- ── mods ─────────────────────────────────────────────────────────────────────
create table if not exists mods (
  id           uuid primary key default uuid_generate_v4(),
  car_id       uuid not null references cars(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  category     mod_category not null,
  cost         numeric(10,2) check (cost is null or (cost >= 0 and cost <= 1000000)),
  install_date date,
  shop_name    text check (char_length(shop_name) <= 100),
  is_diy       boolean not null default false,
  notes        text check (char_length(notes) <= 2000),
  status       mod_status not null default 'installed',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists mods_car_id_idx on mods(car_id);
create index if not exists mods_user_id_idx on mods(user_id);
create index if not exists mods_status_idx on mods(status);
create index if not exists mods_install_date_idx on mods(install_date);

-- ── mod_photos ───────────────────────────────────────────────────────────────
create table if not exists mod_photos (
  id         uuid primary key default uuid_generate_v4(),
  mod_id     uuid not null references mods(id) on delete cascade,
  car_id     uuid not null references cars(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  url        text not null,
  created_at timestamptz not null default now()
);

create index if not exists mod_photos_mod_id_idx on mod_photos(mod_id);

-- ── renders ──────────────────────────────────────────────────────────────────
create table if not exists renders (
  id           uuid primary key default uuid_generate_v4(),
  car_id       uuid not null references cars(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  user_prompt  text not null check (char_length(user_prompt) <= 500),
  image_prompt text not null,
  image_url    text,
  created_at   timestamptz not null default now()
);

create index if not exists renders_car_id_idx on renders(car_id);
create index if not exists renders_user_id_idx on renders(user_id);

-- ── likes ────────────────────────────────────────────────────────────────────
create table if not exists likes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  car_id     uuid not null references cars(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_unique unique (user_id, car_id)
);

create index if not exists likes_car_id_idx on likes(car_id);

-- ── comments ─────────────────────────────────────────────────────────────────
create table if not exists comments (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  car_id     uuid not null references cars(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists comments_car_id_idx on comments(car_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles on profiles;
create trigger set_updated_at_profiles
  before update on profiles
  for each row execute function handle_updated_at();

drop trigger if exists set_updated_at_cars on cars;
create trigger set_updated_at_cars
  before update on cars
  for each row execute function handle_updated_at();

drop trigger if exists set_updated_at_mods on mods;
create trigger set_updated_at_mods
  before update on mods
  for each row execute function handle_updated_at();

-- ── Auto-create profile on signup ─────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _username text;
  _counter  int := 0;
  _candidate text;
begin
  -- Derive username from OAuth metadata or email
  _username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );

  -- Sanitize to allowed characters
  _username := lower(regexp_replace(_username, '[^a-zA-Z0-9_]', '', 'g'));
  _username := substr(_username, 1, 20);

  if char_length(_username) < 3 then
    _username := 'user' || _username;
  end if;

  -- Ensure uniqueness
  _candidate := _username;
  loop
    exit when not exists (
      select 1 from profiles where lower(username) = lower(_candidate)
    );
    _counter := _counter + 1;
    _candidate := _username || _counter;
  end loop;

  insert into profiles (user_id, username, display_name, avatar_url)
  values (
    new.id,
    _candidate,
    coalesce(new.raw_user_meta_data->>'full_name', _candidate),
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ────────────────────────────────────────────────────────────────────────��────
-- ROW LEVEL SECURITY POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles    enable row level security;
alter table cars        enable row level security;
alter table mods        enable row level security;
alter table mod_photos  enable row level security;
alter table renders     enable row level security;
alter table likes       enable row level security;
alter table comments    enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────────
drop policy if exists "profiles: public read" on profiles;
create policy "profiles: public read"
  on profiles for select
  using (true);

drop policy if exists "profiles: own write" on profiles;
create policy "profiles: own write"
  on profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── cars ─────────────────────────────────────────────────────────────────────
drop policy if exists "cars: owner all" on cars;
create policy "cars: owner all"
  on cars for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cars: public read" on cars;
create policy "cars: public read"
  on cars for select
  using (is_public = true);

-- ── mods ─────────────────────────────────────────────────────────────────────
drop policy if exists "mods: owner all" on mods;
create policy "mods: owner all"
  on mods for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mods: public car read" on mods;
create policy "mods: public car read"
  on mods for select
  using (
    exists (
      select 1 from cars c
      where c.id = mods.car_id and c.is_public = true
    )
  );

-- ── mod_photos ───────────────────────────────────────────────────────────────
drop policy if exists "mod_photos: owner all" on mod_photos;
create policy "mod_photos: owner all"
  on mod_photos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mod_photos: public car read" on mod_photos;
create policy "mod_photos: public car read"
  on mod_photos for select
  using (
    exists (
      select 1 from cars c
      where c.id = mod_photos.car_id and c.is_public = true
    )
  );

-- ── renders ──────────────────────────────────────────────────────────────────
drop policy if exists "renders: owner all" on renders;
create policy "renders: owner all"
  on renders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── likes ────────────────────────────────────────────────────────────────────
drop policy if exists "likes: authenticated read" on likes;
create policy "likes: authenticated read"
  on likes for select
  using (true);

drop policy if exists "likes: owner write" on likes;
create policy "likes: owner write"
  on likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "likes: owner delete" on likes;
create policy "likes: owner delete"
  on likes for delete
  using (auth.uid() = user_id);

-- ── comments ─────────────────────────────────────────────────────────────────
drop policy if exists "comments: public read" on comments;
create policy "comments: public read"
  on comments for select
  using (true);

drop policy if exists "comments: authenticated insert" on comments;
create policy "comments: authenticated insert"
  on comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "comments: owner delete" on comments;
create policy "comments: owner delete"
  on comments for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────────────────────
-- Run these separately if the SQL editor doesn't support storage API calls.
-- Or use the Supabase Dashboard → Storage → New bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mod-photos', 'mod-photos', false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'car-covers', 'car-covers', true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS: users can only manage their own files
drop policy if exists "mod-photos: owner upload" on storage.objects;
create policy "mod-photos: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'mod-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "mod-photos: owner read" on storage.objects;
create policy "mod-photos: owner read"
  on storage.objects for select
  using (
    bucket_id = 'mod-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "mod-photos: owner delete" on storage.objects;
create policy "mod-photos: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'mod-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "car-covers: public read" on storage.objects;
create policy "car-covers: public read"
  on storage.objects for select
  using (bucket_id = 'car-covers');

drop policy if exists "car-covers: owner upload" on storage.objects;
create policy "car-covers: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'car-covers' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "car-covers: owner update" on storage.objects;
create policy "car-covers: owner update"
  on storage.objects for update
  using (
    bucket_id = 'car-covers' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "car-covers: owner delete" on storage.objects;
create policy "car-covers: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'car-covers' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

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
  -- Vehicle specs (AI-estimated or user-provided)
  horsepower      int check (horsepower is null or (horsepower >= 1 and horsepower <= 5000)),
  torque          int check (torque is null or (torque >= 1 and torque <= 10000)),
  engine_size     text check (char_length(engine_size) <= 80),
  drivetrain      text check (drivetrain is null or drivetrain in ('RWD', 'FWD', 'AWD', '4WD')),
  transmission    text check (char_length(transmission) <= 80),
  curb_weight     int check (curb_weight is null or (curb_weight >= 100 and curb_weight <= 20000)),
  zero_to_sixty   numeric(4,2) check (zero_to_sixty is null or (zero_to_sixty > 0 and zero_to_sixty < 60)),
  top_speed       int check (top_speed is null or (top_speed >= 30 and top_speed <= 500)),
  specs_ai_guessed boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cars_vin_format check (
    vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'
  )
);

-- Case-insensitive unique username index
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

-- ── forum_posts ──────────────────────────────────────────────────────────────
create table if not exists forum_posts (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  car_id        uuid references cars(id) on delete set null,
  title         text not null check (char_length(title) between 3 and 200),
  content       text not null check (char_length(content) between 10 and 5000),
  category      text not null default 'general' check (category in ('general', 'build', 'advice', 'showcase', 'for_sale')),
  likes_count   int not null default 0,
  replies_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists forum_posts_user_id_idx on forum_posts(user_id);
create index if not exists forum_posts_category_idx on forum_posts(category);
create index if not exists forum_posts_created_at_idx on forum_posts(created_at desc);

-- ── forum_replies ─────────────────────────────────────────────────────────────
create table if not exists forum_replies (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  post_id    uuid not null references forum_posts(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists forum_replies_post_id_idx on forum_replies(post_id);

-- ── forum_likes ───────────────────────────────────────────────────────────────
create table if not exists forum_likes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  post_id    uuid not null references forum_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint forum_likes_unique unique (user_id, post_id)
);

create index if not exists forum_likes_post_id_idx on forum_likes(post_id);

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

drop trigger if exists set_updated_at_forum_posts on forum_posts;
create trigger set_updated_at_forum_posts
  before update on forum_posts
  for each row execute function handle_updated_at();

-- ── Auto-create profile on signup ─────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _username text;
  _counter  int := 0;
  _candidate text;
begin
  _username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );
  _username := lower(regexp_replace(_username, '[^a-zA-Z0-9_]', '', 'g'));
  _username := substr(_username, 1, 20);
  if char_length(_username) < 3 then
    _username := 'user' || _username;
  end if;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles    enable row level security;
alter table cars        enable row level security;
alter table mods        enable row level security;
alter table mod_photos  enable row level security;
alter table renders     enable row level security;
alter table likes       enable row level security;
alter table comments    enable row level security;
alter table forum_posts   enable row level security;
alter table forum_replies enable row level security;
alter table forum_likes   enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────────
drop policy if exists "profiles: public read" on profiles;
create policy "profiles: public read"
  on profiles for select using (true);

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
    exists (select 1 from cars c where c.id = mods.car_id and c.is_public = true)
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
    exists (select 1 from cars c where c.id = mod_photos.car_id and c.is_public = true)
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
  on likes for select using (true);

drop policy if exists "likes: owner write" on likes;
create policy "likes: owner write"
  on likes for insert with check (auth.uid() = user_id);

drop policy if exists "likes: owner delete" on likes;
create policy "likes: owner delete"
  on likes for delete using (auth.uid() = user_id);

-- ── comments ─────────────────────────────────────────────────────────────────
drop policy if exists "comments: public read" on comments;
create policy "comments: public read"
  on comments for select using (true);

drop policy if exists "comments: authenticated insert" on comments;
create policy "comments: authenticated insert"
  on comments for insert with check (auth.uid() = user_id);

drop policy if exists "comments: owner delete" on comments;
create policy "comments: owner delete"
  on comments for delete using (auth.uid() = user_id);

-- ── forum_posts ──────────────────────────────────────────────────────────────
drop policy if exists "forum_posts: public read" on forum_posts;
create policy "forum_posts: public read"
  on forum_posts for select using (true);

drop policy if exists "forum_posts: auth insert" on forum_posts;
create policy "forum_posts: auth insert"
  on forum_posts for insert with check (auth.uid() = user_id);

drop policy if exists "forum_posts: owner update" on forum_posts;
create policy "forum_posts: owner update"
  on forum_posts for update using (auth.uid() = user_id);

drop policy if exists "forum_posts: owner delete" on forum_posts;
create policy "forum_posts: owner delete"
  on forum_posts for delete using (auth.uid() = user_id);

-- ── forum_replies ─────────────────────────────────────────────────────────────
drop policy if exists "forum_replies: public read" on forum_replies;
create policy "forum_replies: public read"
  on forum_replies for select using (true);

drop policy if exists "forum_replies: auth insert" on forum_replies;
create policy "forum_replies: auth insert"
  on forum_replies for insert with check (auth.uid() = user_id);

drop policy if exists "forum_replies: owner delete" on forum_replies;
create policy "forum_replies: owner delete"
  on forum_replies for delete using (auth.uid() = user_id);

-- ── forum_likes ───────────────────────────────────────────────────────────────
drop policy if exists "forum_likes: public read" on forum_likes;
create policy "forum_likes: public read"
  on forum_likes for select using (true);

drop policy if exists "forum_likes: owner write" on forum_likes;
create policy "forum_likes: owner write"
  on forum_likes for insert with check (auth.uid() = user_id);

drop policy if exists "forum_likes: owner delete" on forum_likes;
create policy "forum_likes: owner delete"
  on forum_likes for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mod-photos', 'mod-photos', false,
  5242880,
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

drop policy if exists "mod-photos: owner upload" on storage.objects;
create policy "mod-photos: owner upload" on storage.objects for insert
  with check (bucket_id = 'mod-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "mod-photos: owner read" on storage.objects;
create policy "mod-photos: owner read" on storage.objects for select
  using (bucket_id = 'mod-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "mod-photos: owner delete" on storage.objects;
create policy "mod-photos: owner delete" on storage.objects for delete
  using (bucket_id = 'mod-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "car-covers: public read" on storage.objects;
create policy "car-covers: public read" on storage.objects for select
  using (bucket_id = 'car-covers');

drop policy if exists "car-covers: owner upload" on storage.objects;
create policy "car-covers: owner upload" on storage.objects for insert
  with check (bucket_id = 'car-covers' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "car-covers: owner update" on storage.objects;
create policy "car-covers: owner update" on storage.objects for update
  using (bucket_id = 'car-covers' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "car-covers: owner delete" on storage.objects;
create policy "car-covers: owner delete" on storage.objects for delete
  using (bucket_id = 'car-covers' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Run this block if you have an existing database
-- (adds new columns/tables without dropping existing data)
-- ─────────────────────────────────────────────────────────────────────────────

-- Add vehicle spec columns to existing cars table
alter table cars add column if not exists horsepower int check (horsepower is null or (horsepower >= 1 and horsepower <= 5000));
alter table cars add column if not exists torque int check (torque is null or (torque >= 1 and torque <= 10000));
alter table cars add column if not exists engine_size text check (char_length(engine_size) <= 80);
alter table cars add column if not exists drivetrain text check (drivetrain is null or drivetrain in ('RWD', 'FWD', 'AWD', '4WD'));
alter table cars add column if not exists transmission text check (char_length(transmission) <= 80);
alter table cars add column if not exists curb_weight int check (curb_weight is null or (curb_weight >= 100 and curb_weight <= 20000));
alter table cars add column if not exists zero_to_sixty numeric(4,2) check (zero_to_sixty is null or (zero_to_sixty > 0 and zero_to_sixty < 60));
alter table cars add column if not exists top_speed int check (top_speed is null or (top_speed >= 30 and top_speed <= 500));
alter table cars add column if not exists specs_ai_guessed boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v2: Forum Voting Triggers + Downvotes
-- Run this block in Supabase SQL Editor to enable vote counters and downvotes
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-update likes_count when forum_likes changes
create or replace function update_forum_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update forum_posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update forum_posts set likes_count = greatest(0, likes_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_forum_like_change on forum_likes;
create trigger on_forum_like_change
  after insert or delete on forum_likes
  for each row execute function update_forum_likes_count();

-- Auto-update replies_count when forum_replies changes
create or replace function update_forum_replies_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update forum_posts set replies_count = replies_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update forum_posts set replies_count = greatest(0, replies_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_forum_reply_change on forum_replies;
create trigger on_forum_reply_change
  after insert or delete on forum_replies
  for each row execute function update_forum_replies_count();

-- Add downvotes tracking to forum_posts
alter table forum_posts add column if not exists downvotes_count int not null default 0;

-- Forum downvotes table
create table if not exists forum_downvotes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  post_id    uuid not null references forum_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint forum_downvotes_unique unique (user_id, post_id)
);

create index if not exists forum_downvotes_post_id_idx on forum_downvotes(post_id);

alter table forum_downvotes enable row level security;

drop policy if exists "forum_downvotes: public read" on forum_downvotes;
create policy "forum_downvotes: public read"
  on forum_downvotes for select using (true);

drop policy if exists "forum_downvotes: owner write" on forum_downvotes;
create policy "forum_downvotes: owner write"
  on forum_downvotes for insert with check (auth.uid() = user_id);

drop policy if exists "forum_downvotes: owner delete" on forum_downvotes;
create policy "forum_downvotes: owner delete"
  on forum_downvotes for delete using (auth.uid() = user_id);

-- Auto-update downvotes_count when forum_downvotes changes
create or replace function update_forum_downvotes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update forum_posts set downvotes_count = downvotes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update forum_posts set downvotes_count = greatest(0, downvotes_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_forum_downvote_change on forum_downvotes;
create trigger on_forum_downvote_change
  after insert or delete on forum_downvotes
  for each row execute function update_forum_downvotes_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v3: Primary Car + Car Photo Gallery
-- Run this block in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add is_primary flag to cars (one primary car per user)
alter table cars add column if not exists is_primary boolean not null default false;

create index if not exists cars_is_primary_idx on cars(user_id, is_primary) where is_primary = true;

-- ── car_photos ────────────────────────────────────────────────────────────────
-- Stores multiple photos per car; position controls display order
create table if not exists car_photos (
  id         uuid primary key default uuid_generate_v4(),
  car_id     uuid not null references cars(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  url        text not null,
  position   int not null default 1,
  is_cover   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists car_photos_car_id_idx on car_photos(car_id);
create index if not exists car_photos_position_idx on car_photos(car_id, position);

alter table car_photos enable row level security;

drop policy if exists "car_photos: owner all" on car_photos;
create policy "car_photos: owner all"
  on car_photos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "car_photos: public car read" on car_photos;
create policy "car_photos: public car read"
  on car_photos for select
  using (
    exists (select 1 from cars c where c.id = car_photos.car_id and c.is_public = true)
  );

-- Increase car-covers bucket file size limit to 8MB for gallery photos
update storage.buckets
  set file_size_limit = 8388608
  where id = 'car-covers';

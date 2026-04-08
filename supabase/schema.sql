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

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v4: Purchases table (Shop tracking)
-- Run this block in Supabase SQL Editor to enable the Shop > My Purchases
-- feature. The Shop page will silently fall back to an empty list until this
-- migration is applied.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists purchases (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  car_id        uuid references cars(id) on delete set null,
  mod_id        uuid references mods(id) on delete set null,
  item_name     text not null check (char_length(item_name) between 1 and 200),
  price         numeric(10, 2) not null check (price >= 0),
  retailer      text check (char_length(retailer) <= 120),
  purchased_at  date not null default current_date,
  notes         text check (char_length(notes) <= 2000),
  created_at    timestamptz not null default now()
);

create index if not exists purchases_user_id_idx on purchases(user_id);
create index if not exists purchases_car_id_idx  on purchases(car_id);
create index if not exists purchases_mod_id_idx  on purchases(mod_id);
create index if not exists purchases_purchased_at_idx on purchases(user_id, purchased_at desc);

alter table purchases enable row level security;

drop policy if exists "purchases: owner all" on purchases;
create policy "purchases: owner all"
  on purchases for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v5: Chat conversations
-- Run this block in Supabase SQL Editor to enable persistent server-side chat
-- history. The chat page will use localStorage if this migration is not yet
-- applied.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v6: Cached image descriptors + stock spec baseline + render flag
--               + wishlist linkage + awards collection
-- Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Cache the AI description of each uploaded photo so we never re-analyze.
alter table car_photos add column if not exists image_descriptor text;

-- ── Locked-in stock spec baseline. Captured the FIRST time the AI calculator
-- runs and never overwritten so a delta vs stock is always derivable.
alter table cars add column if not exists stock_horsepower    int;
alter table cars add column if not exists stock_torque        int;
alter table cars add column if not exists stock_curb_weight   int;
alter table cars add column if not exists stock_zero_to_sixty numeric(4,2);
alter table cars add column if not exists stock_top_speed     int;
alter table cars add column if not exists stock_engine_size   text;
alter table cars add column if not exists stock_drivetrain    text;
alter table cars add column if not exists stock_transmission  text;

-- ── Mark renders so the visualizer never feeds its own outputs back in
alter table renders add column if not exists is_banner boolean not null default false;

-- ── Privacy + social (Feature 19)
alter table profiles add column if not exists is_public boolean not null default true;

-- ── Awards collection (Feature 16)
create table if not exists user_awards (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  award_id     text not null,
  unlocked_at  timestamptz not null default now(),
  is_featured  boolean not null default false,
  constraint user_awards_unique unique (user_id, award_id)
);

create index if not exists user_awards_user_id_idx on user_awards(user_id);

alter table user_awards enable row level security;

drop policy if exists "user_awards: public read" on user_awards;
create policy "user_awards: public read" on user_awards for select using (true);

drop policy if exists "user_awards: owner write" on user_awards;
create policy "user_awards: owner write" on user_awards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists chat_conversations (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'New conversation',
  messages   jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_id_idx on chat_conversations(user_id);
alter table chat_conversations enable row level security;

drop policy if exists "chat_conversations: owner all" on chat_conversations;
create policy "chat_conversations: owner all"
  on chat_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v7: Pixel cards + sell flow
-- Each car can earn ONE permanent pixel-art trading card with an
-- AI-generated nickname. Generation is one-shot and irreversible. Cars are
-- never hard-deleted from the UI anymore — they're sold and archived to a
-- "Past Builds" section. Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Owner-written description (required, ≥80 chars, before pixel card unlocks)
alter table cars add column if not exists description text;

-- ── Permanent pixel card (Feature: Pixel Card system)
alter table cars add column if not exists pixel_card_url text;
alter table cars add column if not exists pixel_card_nickname text;
alter table cars add column if not exists pixel_card_generated_at timestamptz;

-- ── Sold / archived state (replaces hard delete)
alter table cars add column if not exists is_sold boolean not null default false;
alter table cars add column if not exists sold_at timestamptz;

create index if not exists cars_is_sold_idx on cars(user_id, is_sold);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v8: Pixel card snapshot stats
-- Snapshot of the car's data at the moment the pixel card was minted.
-- These values are frozen forever so the card is a true time-capsule.
-- ─────────────────────────────────────────────────────────────────────────────
alter table cars add column if not exists pixel_card_hp          integer;
alter table cars add column if not exists pixel_card_mod_count   integer;
alter table cars add column if not exists pixel_card_build_score integer;
alter table cars add column if not exists pixel_card_rarity      text;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v9: VIN verification
-- Marks a car as cryptographically linked to its real-world VIN via the NHTSA
-- decode API.
-- Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────
alter table cars add column if not exists vin_verified boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v10: Pixel cards table + remove rarity / sell flow
-- Cards become memory snapshots: independent rows, persist after car deletion.
-- Drop the per-car singleton card columns, drop is_sold/sold_at, restore
-- normal car deletion. Add last_card_minted_at for cooldown tracking.
-- Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pixel_cards (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  car_id          uuid references cars(id) on delete set null,
  car_snapshot    jsonb not null,
  pixel_card_url  text not null,
  nickname        text not null,
  hp              integer,
  mod_count       integer,
  minted_at       timestamptz not null default now()
);

create index if not exists pixel_cards_user_id_idx   on pixel_cards(user_id);
create index if not exists pixel_cards_car_id_idx    on pixel_cards(car_id);
create index if not exists pixel_cards_minted_at_idx on pixel_cards(user_id, minted_at desc);

alter table pixel_cards enable row level security;

drop policy if exists "pixel_cards: owner all" on pixel_cards;
create policy "pixel_cards: owner all"
  on pixel_cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pixel_cards: public read" on pixel_cards;
create policy "pixel_cards: public read"
  on pixel_cards for select
  using (true);

-- Drop the old per-car singleton columns
alter table cars drop column if exists pixel_card_url;
alter table cars drop column if exists pixel_card_nickname;
alter table cars drop column if exists pixel_card_generated_at;
alter table cars drop column if exists pixel_card_hp;
alter table cars drop column if exists pixel_card_mod_count;
alter table cars drop column if exists pixel_card_build_score;
alter table cars drop column if exists pixel_card_rarity;

-- Restore normal car deletion — drop the sell columns
alter table cars drop column if exists is_sold;
alter table cars drop column if exists sold_at;

-- Cooldown tracker (72h between mints per car)
alter table cars add column if not exists last_card_minted_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v11: Card identity — card_number, flavor_text, era
-- Each minted card gets a globally unique sequential card number (e.g. #0042),
-- an AI-generated 2-sentence poetic flavor text, and a randomly assigned era
-- badge (Dawn / Chrome / Turbo / Neon / Apex).
-- Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Globally unique sequential card number — auto-increments across all cards
create sequence if not exists pixel_cards_card_number_seq;
alter table pixel_cards
  add column if not exists card_number bigint not null
    default nextval('pixel_cards_card_number_seq');

create unique index if not exists pixel_cards_card_number_idx on pixel_cards(card_number);

-- AI-generated 2-sentence poetic flavor text (stored with the card forever)
alter table pixel_cards add column if not exists flavor_text text;

-- Collectible era badge: one of Dawn / Chrome / Turbo / Neon / Apex
alter table pixel_cards add column if not exists era text not null default 'Chrome';

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v12: Occasion note + remove cooldown
-- Cards now carry a frozen occasion note ("Just picked her up", "Aerokit installed").
-- The 72h cooldown is removed — users can mint any time they have a real photo.
-- Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Occasion note frozen onto the card forever (max 100 chars enforced in app layer)
alter table pixel_cards add column if not exists occasion text;

-- Drop cooldown tracker — no longer used
alter table cars drop column if exists last_card_minted_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v13: Card rarity + public feed
-- Adds rarity tier (Common/Uncommon/Rare/Ultra Rare/Legendary) assigned at mint
-- time and an is_public flag controlling community feed visibility.
-- Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Rarity tier: assigned algorithmically at mint time
alter table pixel_cards add column if not exists rarity text not null default 'Common';

-- Public feed visibility: true by default, user can opt out at mint time
alter table pixel_cards add column if not exists is_public boolean not null default true;

-- Index for fast feed queries
create index if not exists pixel_cards_is_public_idx on pixel_cards(is_public, minted_at desc)
  where is_public = true;

-- Update RLS: allow anyone (including unauthenticated) to read public cards.
-- The existing "pixel_cards: owner all" policy continues to cover owner reads/writes.
drop policy if exists "pixel_cards: public feed read" on pixel_cards;
create policy "pixel_cards: public feed read"
  on pixel_cards for select
  using (is_public = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v14: ModVault core systems
--   - Card generation data (archetype, traits, performance, etc.)
--   - Builder Score components
--   - Community ratings (cleanliness/creativity/execution/presence)
--   - Flags & endorsements
--   - Battle system
--   - Notifications
--   - Achievements (unified)
--   - Vehicle stock specs lookup table
-- Run this block in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Card generation data on pixel_cards ─────────────────────────────────────
alter table pixel_cards add column if not exists card_title               text;
alter table pixel_cards add column if not exists build_archetype          text;
alter table pixel_cards add column if not exists estimated_performance    jsonb;
alter table pixel_cards add column if not exists ai_estimated_performance jsonb;
alter table pixel_cards add column if not exists build_aggression         int check (build_aggression is null or (build_aggression between 1 and 10));
alter table pixel_cards add column if not exists uniqueness_score         int check (uniqueness_score is null or (uniqueness_score between 0 and 100));
alter table pixel_cards add column if not exists authenticity_confidence  int check (authenticity_confidence is null or (authenticity_confidence between 0 and 100));
alter table pixel_cards add column if not exists traits                   jsonb;
alter table pixel_cards add column if not exists flavour_text             text;
alter table pixel_cards add column if not exists weaknesses               jsonb;
alter table pixel_cards add column if not exists rival_archetypes         jsonb;
alter table pixel_cards add column if not exists battle_record            jsonb not null default '{"wins":0,"losses":0}'::jsonb;
alter table pixel_cards add column if not exists last_battle_at           timestamptz;

create index if not exists pixel_cards_archetype_idx on pixel_cards(build_archetype);
create index if not exists pixel_cards_authenticity_idx on pixel_cards(authenticity_confidence);

-- ── builder_scores ───────────────────────────────────────────────────────────
create table if not exists builder_scores (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  documentation_quality   int not null default 0 check (documentation_quality between 0 and 1000),
  community_trust         int not null default 0 check (community_trust between 0 and 1000),
  engagement_authenticity int not null default 0 check (engagement_authenticity between 0 and 1000),
  build_consistency       int not null default 0 check (build_consistency between 0 and 1000),
  platform_tenure         int not null default 0 check (platform_tenure between 0 and 1000),
  composite_score         int not null default 0 check (composite_score between 0 and 1000),
  tier_label              text not null default 'Newcomer',
  last_calculated_at      timestamptz not null default now()
);

create index if not exists builder_scores_composite_idx on builder_scores(composite_score desc);

alter table builder_scores enable row level security;

drop policy if exists "builder_scores: public read" on builder_scores;
create policy "builder_scores: public read"
  on builder_scores for select using (true);

drop policy if exists "builder_scores: owner write" on builder_scores;
create policy "builder_scores: owner write"
  on builder_scores for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── card_ratings ─────────────────────────────────────────────────────────────
create table if not exists card_ratings (
  id                          uuid primary key default uuid_generate_v4(),
  card_id                     uuid not null references pixel_cards(id) on delete cascade,
  rater_id                    uuid not null references auth.users(id) on delete cascade,
  rater_builder_score_at_time int not null default 0,
  cleanliness                 int not null check (cleanliness between 1 and 5),
  creativity                  int not null check (creativity between 1 and 5),
  execution                   int not null check (execution between 1 and 5),
  presence                    int not null check (presence between 1 and 5),
  weighted_composite          numeric(5,2) not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint card_ratings_unique unique (card_id, rater_id)
);

create index if not exists card_ratings_card_id_idx on card_ratings(card_id);
create index if not exists card_ratings_rater_id_idx on card_ratings(rater_id);

alter table card_ratings enable row level security;

drop policy if exists "card_ratings: public read" on card_ratings;
create policy "card_ratings: public read"
  on card_ratings for select using (true);

drop policy if exists "card_ratings: rater write" on card_ratings;
create policy "card_ratings: rater write"
  on card_ratings for all
  using (auth.uid() = rater_id)
  with check (
    auth.uid() = rater_id
    and not exists (
      select 1 from pixel_cards pc
      where pc.id = card_ratings.card_id and pc.user_id = auth.uid()
    )
  );

drop trigger if exists set_updated_at_card_ratings on card_ratings;
create trigger set_updated_at_card_ratings
  before update on card_ratings
  for each row execute function handle_updated_at();

-- ── card_battles ─────────────────────────────────────────────────────────────
create table if not exists card_battles (
  id                   uuid primary key default uuid_generate_v4(),
  challenger_card_id   uuid not null references pixel_cards(id) on delete cascade,
  opponent_card_id     uuid not null references pixel_cards(id) on delete cascade,
  challenger_user_id   uuid not null references auth.users(id) on delete cascade,
  opponent_user_id     uuid not null references auth.users(id) on delete cascade,
  outcome              text not null check (outcome in ('win', 'loss', 'narrow_win', 'narrow_loss')),
  score_breakdown      jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists card_battles_challenger_idx on card_battles(challenger_user_id, created_at desc);
create index if not exists card_battles_opponent_idx on card_battles(opponent_user_id, created_at desc);
create index if not exists card_battles_card_idx on card_battles(challenger_card_id, created_at desc);

alter table card_battles enable row level security;

drop policy if exists "card_battles: public read" on card_battles;
create policy "card_battles: public read"
  on card_battles for select using (true);

drop policy if exists "card_battles: challenger insert" on card_battles;
create policy "card_battles: challenger insert"
  on card_battles for insert
  with check (auth.uid() = challenger_user_id);

-- ── card_credibility_signals (flag/endorse) ──────────────────────────────────
create table if not exists card_credibility_signals (
  id          uuid primary key default uuid_generate_v4(),
  card_id     uuid not null references pixel_cards(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('flag', 'endorse')),
  weight      numeric(5,2) not null default 1.0,
  reason      text check (char_length(reason) <= 500),
  created_at  timestamptz not null default now(),
  constraint card_credibility_signals_unique unique (card_id, user_id, signal_type)
);

create index if not exists ccs_card_id_idx on card_credibility_signals(card_id);

alter table card_credibility_signals enable row level security;

drop policy if exists "ccs: rater read own" on card_credibility_signals;
create policy "ccs: rater read own"
  on card_credibility_signals for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from pixel_cards pc
      where pc.id = card_credibility_signals.card_id and pc.user_id = auth.uid()
    )
  );

drop policy if exists "ccs: owner write" on card_credibility_signals;
create policy "ccs: owner write"
  on card_credibility_signals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── notifications ────────────────────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id, read, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notifications: owner all" on notifications;
create policy "notifications: owner all"
  on notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── achievements (unified) ───────────────────────────────────────────────────
create table if not exists achievements (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  achievement_type text not null,
  category         text not null check (category in ('builder', 'community', 'battle', 'platform')),
  earned_at        timestamptz not null default now(),
  progress_data    jsonb not null default '{}'::jsonb,
  constraint achievements_unique unique (user_id, achievement_type)
);

create index if not exists achievements_user_id_idx on achievements(user_id, earned_at desc);

alter table achievements enable row level security;

drop policy if exists "achievements: public read" on achievements;
create policy "achievements: public read"
  on achievements for select using (true);

drop policy if exists "achievements: owner write" on achievements;
create policy "achievements: owner write"
  on achievements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── vehicle_stock_specs ──────────────────────────────────────────────────────
create table if not exists vehicle_stock_specs (
  id              uuid primary key default uuid_generate_v4(),
  year            int not null,
  make            text not null,
  model           text not null,
  trim            text,
  hp              int,
  torque          int,
  zero_to_sixty   numeric(4,2),
  top_speed       int,
  weight          int,
  notes           text,
  created_at      timestamptz not null default now()
);

create unique index if not exists vehicle_stock_specs_unique_idx
  on vehicle_stock_specs (year, lower(make), lower(model), coalesce(lower(trim), ''));

create index if not exists vehicle_stock_specs_make_model_idx on vehicle_stock_specs(lower(make), lower(model));

alter table vehicle_stock_specs enable row level security;

drop policy if exists "vehicle_stock_specs: public read" on vehicle_stock_specs;
create policy "vehicle_stock_specs: public read"
  on vehicle_stock_specs for select using (true);

-- ── Seed common vehicle stock specs ──────────────────────────────────────────
-- Ranges cover: Porsche 911 variants, BMW M cars, Toyota/Honda performance,
-- American muscle, European hot hatches.
insert into vehicle_stock_specs (year, make, model, trim, hp, torque, zero_to_sixty, top_speed, weight) values
  -- Porsche 911
  (2020, 'Porsche', '911', 'Carrera',         379, 331, 4.0, 182, 3354),
  (2020, 'Porsche', '911', 'Carrera S',       443, 390, 3.5, 191, 3382),
  (2020, 'Porsche', '911', 'Carrera 4S',      443, 390, 3.4, 190, 3497),
  (2020, 'Porsche', '911', 'Turbo',           572, 553, 2.7, 199, 3636),
  (2020, 'Porsche', '911', 'Turbo S',         640, 590, 2.6, 205, 3636),
  (2020, 'Porsche', '911', 'GT3',             502, 346, 3.2, 197, 3164),
  (2018, 'Porsche', '911', 'Carrera',         370, 331, 4.4, 183, 3153),
  (2015, 'Porsche', '911', 'GT3',             475, 324, 3.3, 196, 3153),
  -- Porsche 718
  (2020, 'Porsche', 'Cayman', 'GT4',          414, 309, 4.2, 188, 3199),
  (2020, 'Porsche', 'Boxster', 'S',           350, 309, 4.2, 177, 3100),
  -- BMW M3
  (2021, 'BMW', 'M3', 'Competition',          503, 479, 3.5, 180, 3890),
  (2021, 'BMW', 'M3', 'Base',                 473, 406, 3.9, 155, 3825),
  (2018, 'BMW', 'M3', 'Competition',          444, 406, 3.9, 174, 3595),
  (2015, 'BMW', 'M3', 'Base',                 425, 406, 4.1, 155, 3540),
  -- BMW M4
  (2021, 'BMW', 'M4', 'Competition',          503, 479, 3.5, 180, 3880),
  (2018, 'BMW', 'M4', 'Competition',          444, 406, 3.8, 174, 3590),
  -- BMW M2
  (2020, 'BMW', 'M2', 'Competition',          405, 406, 4.0, 174, 3600),
  (2023, 'BMW', 'M2', 'Base',                 453, 406, 3.9, 177, 3814),
  -- BMW M5
  (2020, 'BMW', 'M5', 'Competition',          617, 553, 3.1, 190, 4378),
  (2020, 'BMW', 'M5', 'Base',                 600, 553, 3.2, 189, 4370),
  -- Toyota GR Supra
  (2021, 'Toyota', 'Supra', 'GR 3.0',         382, 368, 3.9, 155, 3400),
  (2020, 'Toyota', 'Supra', 'GR 3.0',         335, 365, 4.1, 155, 3397),
  -- Toyota GR86 / 86
  (2022, 'Toyota', 'GR86', 'Base',            228, 184, 6.1, 140, 2811),
  (2020, 'Toyota', '86', 'Base',              205, 156, 6.2, 140, 2776),
  -- Honda Civic Type R
  (2023, 'Honda', 'Civic', 'Type R',          315, 310, 5.4, 171, 3188),
  (2018, 'Honda', 'Civic', 'Type R',          306, 295, 5.0, 169, 3117),
  (2022, 'Honda', 'Civic', 'Si',              200, 192, 6.6, 137, 2952),
  -- Honda S2000
  (2005, 'Honda', 'S2000', 'AP2',             237, 162, 5.6, 149, 2855),
  (2002, 'Honda', 'S2000', 'AP1',             240, 153, 5.8, 150, 2809),
  -- Nissan GT-R
  (2020, 'Nissan', 'GT-R', 'Premium',         565, 467, 2.9, 196, 3933),
  (2020, 'Nissan', 'GT-R', 'Nismo',           600, 481, 2.5, 205, 3865),
  (2015, 'Nissan', 'GT-R', 'Premium',         545, 463, 2.9, 196, 3829),
  -- Nissan 370Z / 400Z
  (2020, 'Nissan', '370Z', 'Nismo',           350, 276, 4.9, 155, 3380),
  (2023, 'Nissan', 'Z', 'Performance',        400, 350, 4.5, 155, 3528),
  -- Mazda MX-5 Miata
  (2022, 'Mazda', 'MX-5 Miata', 'Club',       181, 151, 5.7, 135, 2341),
  (2020, 'Mazda', 'MX-5 Miata', 'Grand Touring', 181, 151, 5.8, 135, 2339),
  -- Subaru WRX STI
  (2021, 'Subaru', 'WRX STI', 'Base',         310, 290, 5.1, 174, 3391),
  (2018, 'Subaru', 'WRX STI', 'Type RA',      310, 290, 5.0, 174, 3384),
  -- Subaru BRZ
  (2022, 'Subaru', 'BRZ', 'Limited',          228, 184, 6.0, 140, 2835),
  -- Ford Mustang
  (2020, 'Ford', 'Mustang', 'GT',             460, 420, 4.2, 155, 3705),
  (2020, 'Ford', 'Mustang', 'Shelby GT500',   760, 625, 3.3, 180, 4171),
  (2020, 'Ford', 'Mustang', 'Shelby GT350',   526, 429, 3.9, 170, 3791),
  (2020, 'Ford', 'Mustang', 'EcoBoost',       310, 350, 5.3, 155, 3532),
  -- Chevrolet Corvette
  (2020, 'Chevrolet', 'Corvette', 'Stingray', 495, 470, 2.9, 194, 3366),
  (2023, 'Chevrolet', 'Corvette', 'Z06',      670, 460, 2.6, 195, 3434),
  (2019, 'Chevrolet', 'Corvette', 'ZR1',      755, 715, 2.85, 212, 3560),
  -- Chevrolet Camaro
  (2020, 'Chevrolet', 'Camaro', 'SS 1LE',     455, 455, 4.0, 165, 3685),
  (2020, 'Chevrolet', 'Camaro', 'ZL1',        650, 650, 3.5, 198, 3907),
  -- Dodge Challenger
  (2020, 'Dodge', 'Challenger', 'Hellcat',         717, 656, 3.6, 199, 4448),
  (2020, 'Dodge', 'Challenger', 'Hellcat Redeye',  797, 707, 3.4, 203, 4492),
  (2020, 'Dodge', 'Challenger', 'R/T Scat Pack',   485, 475, 4.3, 175, 4251),
  -- European hot hatches
  (2022, 'Volkswagen', 'Golf', 'GTI',              241, 273, 5.9, 155, 3150),
  (2022, 'Volkswagen', 'Golf', 'R',                315, 310, 4.7, 168, 3351),
  (2018, 'Volkswagen', 'Golf', 'R',                292, 280, 4.5, 155, 3335),
  (2020, 'Audi', 'RS3',                  null,     401, 354, 3.9, 155, 3593),
  (2022, 'Audi', 'RS5',                  null,     444, 443, 3.7, 174, 3814),
  (2020, 'Audi', 'S3',                   null,     292, 295, 4.6, 155, 3417),
  -- Mercedes AMG
  (2020, 'Mercedes-Benz', 'C63',         'AMG S',  503, 516, 3.7, 180, 3880),
  (2020, 'Mercedes-Benz', 'A45',         'AMG S',  416, 369, 3.9, 168, 3638),
  (2022, 'Mercedes-Benz', 'AMG GT',      'Black Series', 720, 590, 3.1, 202, 3616),
  -- Tesla
  (2022, 'Tesla', 'Model S',    'Plaid',   1020, 1050, 1.99, 200, 4766),
  (2022, 'Tesla', 'Model 3',    'Performance', 450, 471, 3.1, 162, 4048),
  -- Acura / Lexus
  (2020, 'Lexus', 'RC F',       null,      472, 395, 4.3, 168, 3958),
  (2020, 'Acura', 'NSX',        null,      573, 476, 2.9, 191, 3878),
  -- Alfa Romeo
  (2020, 'Alfa Romeo', 'Giulia', 'Quadrifoglio', 505, 443, 3.8, 191, 3819)
on conflict do nothing;

-- ── Builder Score recalc helper ──────────────────────────────────────────────
-- Note: This is a no-op placeholder. Actual scoring is computed in Next.js
-- (lib/builder-score.ts) and written via the /api/builder-score/recalculate
-- endpoint. This function exists so DB triggers have something to call.
create or replace function touch_builder_score(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into builder_scores (user_id, last_calculated_at)
  values (_user_id, now())
  on conflict (user_id) do update
    set last_calculated_at = excluded.last_calculated_at;
end;
$$;

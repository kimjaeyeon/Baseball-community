create table public.boards (
  id smallint primary key,
  slug text not null unique,
  name text not null,
  sort smallint not null
);
alter table public.boards enable row level security;
revoke all on public.boards from anon, authenticated;
grant select on public.boards to anon, authenticated;
create policy boards_read on public.boards for select to anon, authenticated using (true);

create table public.posts (
  id bigint generated always as identity primary key,
  board_id smallint not null references public.boards(id),
  author_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('text', 'link')),
  title text not null check (char_length(btrim(title)) between 2 and 100),
  body text,
  url text,
  thumb_path text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  view_count integer not null default 0,
  is_best boolean not null default false,
  best_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint posts_content_check check (
    (kind = 'text' and body is not null and char_length(btrim(body)) between 1 and 20000 and url is null)
    or (kind = 'link' and url is not null and url ~ '^https?://' and (body is null or char_length(body) <= 2000))
  )
);
create index posts_created_idx on public.posts (created_at desc, id desc);
create index posts_board_created_idx on public.posts (board_id, created_at desc, id desc);
create index posts_best_idx on public.posts (best_at desc, id desc) where is_best;

alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert (board_id, author_id, kind, title, body, url, thumb_path) on public.posts to authenticated;
grant update (board_id, title, body, url, thumb_path) on public.posts to authenticated;
grant usage on sequence public.posts_id_seq to authenticated;
create policy posts_read on public.posts for select to anon, authenticated using (deleted_at is null);
create policy posts_insert_own on public.posts for insert to authenticated
  with check (author_id = auth.uid());
create policy posts_update_own on public.posts for update to authenticated
  using (author_id = auth.uid() and deleted_at is null)
  with check (author_id = auth.uid() and deleted_at is null);

create function public.touch_post_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_post_updated_at() from public, anon, authenticated;
create trigger posts_touch_updated_at before update on public.posts
  for each row execute function public.touch_post_updated_at();

create function public.soft_delete_post(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.posts set deleted_at = coalesce(deleted_at, now())
  where id = p_id and author_id = auth.uid();
  if not found then
    raise exception '글을 삭제할 권한이 없습니다' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.soft_delete_post(bigint) from public, anon, authenticated;
grant execute on function public.soft_delete_post(bigint) to authenticated;

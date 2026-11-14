create function public.best_threshold()
returns integer language sql immutable set search_path = public as $$ select 5; $$;

create table public.post_likes (
  post_id bigint not null references public.posts(id),
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
alter table public.post_likes enable row level security;
revoke all on public.post_likes from anon,authenticated;
grant select on public.post_likes to anon,authenticated;
grant insert(post_id,user_id),delete on public.post_likes to authenticated;
create policy post_likes_read on public.post_likes for select to anon,authenticated using (true);
create policy post_likes_insert_own on public.post_likes for insert to authenticated with check (user_id=auth.uid());
create policy post_likes_delete_own on public.post_likes for delete to authenticated using (user_id=auth.uid());

-- Shared by best notifications now and comment/reply notifications in M6.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('comment','reply','best')),
  post_id bigint not null references public.posts(id),
  comment_id bigint references public.comments(id),
  actor_id uuid references public.profiles(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc,id desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
create policy notifications_read_own on public.notifications for select to authenticated using (user_id=auth.uid());

create function public.post_likes_update_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target public.posts%rowtype;
begin
  if tg_op='DELETE' then
    update public.posts set like_count=like_count-1 where id=old.post_id;
    return old;
  end if;
  -- Serialize voting/promotion without conflicting with concurrent FK key-share locks.
  select * into target from public.posts where id=new.post_id for no key update;
  if not found or target.deleted_at is not null then
    raise exception '삭제되었거나 없는 글입니다' using errcode='23514';
  end if;
  if target.author_id=new.user_id then
    raise exception '본인 글에는 추천할 수 없습니다' using errcode='23514';
  end if;
  update public.posts set like_count=like_count+1 where id=new.post_id;
  if not target.is_best and target.like_count+1 >= public.best_threshold() then
    update public.posts set is_best=true,best_at=now() where id=new.post_id;
    insert into public.notifications(user_id,kind,post_id) values(target.author_id,'best',new.post_id);
  end if;
  return new;
end;
$$;
revoke execute on function public.post_likes_update_count() from public,anon,authenticated;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function public.post_likes_update_count();

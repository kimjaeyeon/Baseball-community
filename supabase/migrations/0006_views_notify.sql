create table public.post_views (
  post_id bigint not null references public.posts(id),
  viewer_key text not null check (char_length(btrim(viewer_key)) > 0),
  viewed_on date not null default current_date,
  primary key (post_id, viewer_key, viewed_on)
);
alter table public.post_views enable row level security;
revoke all on public.post_views from public, anon, authenticated;

create function public.increment_view(p_post_id bigint, p_viewer_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  viewer text := coalesce(auth.uid()::text, p_viewer_key);
  inserted integer;
begin
  if viewer is null or char_length(btrim(viewer)) = 0 then
    raise exception '조회자 정보가 없습니다' using errcode = '22023';
  end if;
  -- Serialize counting and deletion; NO KEY UPDATE is compatible with FK locks.
  perform 1 from public.posts where id = p_post_id and deleted_at is null for no key update;
  if not found then return; end if;

  insert into public.post_views(post_id, viewer_key, viewed_on)
  values (p_post_id, viewer, current_date) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    update public.posts set view_count = view_count + 1 where id = p_post_id;
  end if;
end;
$$;
revoke execute on function public.increment_view(bigint, text) from public, anon, authenticated;
grant execute on function public.increment_view(bigint, text) to anon, authenticated;

create function public.comments_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if post_author <> new.author_id then
    insert into public.notifications(user_id, kind, post_id, comment_id, actor_id)
    values (post_author, 'comment', new.post_id, new.id, new.author_id);
  end if;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    -- A post author who also wrote the parent already received a comment notification.
    if parent_author <> new.author_id and parent_author <> post_author then
      insert into public.notifications(user_id, kind, post_id, comment_id, actor_id)
      values (parent_author, 'reply', new.post_id, new.id, new.author_id);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.comments_notify() from public, anon, authenticated;
create trigger comments_notify after insert on public.comments
  for each row execute function public.comments_notify();

create function public.mark_notifications_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
end;
$$;
revoke execute on function public.mark_notifications_read() from public, anon, authenticated;
grant execute on function public.mark_notifications_read() to authenticated;

create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id),
  author_id uuid not null references public.profiles(id),
  parent_id bigint references public.comments(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_post_created_idx on public.comments(post_id, created_at, id);
alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert(post_id,author_id,parent_id,body) on public.comments to authenticated;
grant usage on sequence public.comments_id_seq to authenticated;
create policy comments_read on public.comments for select to anon, authenticated using (true);
create policy comments_insert_own on public.comments for insert to authenticated with check (author_id=auth.uid());

create function public.comments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Serialize with post deletion and counter changes.
  perform 1 from public.posts where id=new.post_id and deleted_at is null for update;
  if not found then
    raise exception '삭제되었거나 없는 글입니다' using errcode='23514';
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.comments where id=new.parent_id and post_id=new.post_id and parent_id is null
  ) then
    raise exception '같은 글의 댓글에만 답글을 달 수 있습니다' using errcode='23514';
  end if;
  return new;
end;
$$;
create function public.comments_update_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op='INSERT' then
    update public.posts set comment_count=comment_count+1 where id=new.post_id;
  elsif old.deleted_at is null and new.deleted_at is not null then
    update public.posts set comment_count=comment_count-1 where id=new.post_id;
  end if;
  return new;
end;
$$;
create trigger comments_validate before insert on public.comments for each row execute function public.comments_before_insert();
create trigger comments_count after insert or update of deleted_at on public.comments for each row execute function public.comments_update_count();
revoke execute on function public.comments_before_insert(),public.comments_update_count() from public,anon,authenticated;

create function public.soft_delete_comment(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.comments set deleted_at=coalesce(deleted_at,now()) where id=p_id and author_id=auth.uid();
  if not found then
    raise exception '댓글을 삭제할 권한이 없습니다' using errcode='42501';
  end if;
end;
$$;
revoke execute on function public.soft_delete_comment(bigint) from public,anon,authenticated;
grant execute on function public.soft_delete_comment(bigint) to authenticated;

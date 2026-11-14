create table public.post_images (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  path text not null,
  thumb_path text not null,
  position smallint not null check (position between 0 and 9),
  unique(post_id, position),
  unique(post_id, path)
);
alter table public.post_images enable row level security;
revoke all on public.post_images from anon, authenticated;
grant select on public.post_images to anon, authenticated;
grant insert, delete on public.post_images to authenticated;
grant usage on sequence public.post_images_id_seq to authenticated;
create policy images_read on public.post_images for select to anon, authenticated using (
  exists (select 1 from public.posts where id=post_id and deleted_at is null)
);
create policy images_insert_own on public.post_images for insert to authenticated with check (
  split_part(path,'/',1)=auth.uid()::text and split_part(thumb_path,'/',1)=auth.uid()::text
  and exists (select 1 from public.posts where id=post_id and author_id=auth.uid() and kind='text' and deleted_at is null)
);
create policy images_delete_own on public.post_images for delete to authenticated using (
  exists (select 1 from public.posts where id=post_id and author_id=auth.uid() and deleted_at is null)
);

-- Storage API deletes cannot join a Postgres transaction. Persist work so an
-- interrupted/failed cleanup can be retried on the author's next saved edit.
create table public.post_image_cleanup (
  user_id uuid not null references public.profiles(id),
  path text not null check (split_part(path,'/',1)=user_id::text),
  primary key(user_id,path)
);
alter table public.post_image_cleanup enable row level security;
revoke all on public.post_image_cleanup from anon,authenticated;
grant select,insert,delete on public.post_image_cleanup to authenticated;
create policy image_cleanup_own on public.post_image_cleanup for all to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('post-images','post-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']);
create policy post_images_read on storage.objects for select to anon, authenticated using (bucket_id='post-images');
create policy post_images_upload on storage.objects for insert to authenticated with check (
  bucket_id='post-images' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy post_images_delete on storage.objects for delete to authenticated using (
  bucket_id='post-images' and (storage.foldername(name))[1]=auth.uid()::text
);

-- Invoker privileges preserve column GRANTs and RLS. Any error rolls back the
-- post edit and attachment replacement together, including on concurrent edits.
create function public.save_post_with_images(
  p_id bigint, p_board_id smallint, p_kind text, p_title text, p_body text,
  p_url text, p_images jsonb, p_representative integer
) returns bigint language plpgsql security invoker set search_path = public as $$
declare
  saved_id bigint;
  image_count integer;
  representative text;
begin
  if auth.uid() is null then raise exception 'Login required' using errcode='42501'; end if;
  if jsonb_typeof(p_images) is distinct from 'array' then
    raise exception 'Invalid images' using errcode='23514';
  end if;
  image_count := jsonb_array_length(p_images);
  if image_count > 10 or p_representative is null or p_representative < 0
    or (image_count=0 and p_representative<>0)
    or (image_count>0 and p_representative>=image_count)
    or (p_kind='link' and image_count>0) then
    raise exception 'Invalid images or representative' using errcode='23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_images) img
    where jsonb_typeof(img) is distinct from 'object'
      or jsonb_typeof(img->'path') is distinct from 'string'
      or jsonb_typeof(img->'thumb_path') is distinct from 'string'
      or split_part(img->>'path','/',1)<>auth.uid()::text
      or split_part(img->>'thumb_path','/',1)<>auth.uid()::text
      or not exists (select 1 from storage.objects where bucket_id='post-images' and name=img->>'path')
      or not exists (select 1 from storage.objects where bucket_id='post-images' and name=img->>'thumb_path')
  ) then raise exception 'Invalid or missing uploaded image' using errcode='23514'; end if;
  representative := p_images->p_representative->>'thumb_path';
  if p_id is null then
    insert into public.posts(board_id,author_id,kind,title,body,url,thumb_path)
      values (p_board_id,auth.uid(),p_kind,p_title,p_body,p_url,representative) returning id into saved_id;
  else
    perform 1 from public.posts where id=p_id and author_id=auth.uid() and kind=p_kind and deleted_at is null for update;
    if not found then raise exception 'Cannot edit post' using errcode='42501'; end if;
    update public.posts set board_id=p_board_id,title=p_title,body=p_body,url=p_url,thumb_path=representative
      where id=p_id returning id into saved_id;
    insert into public.post_image_cleanup(user_id,path)
      select auth.uid(),old_path from (
        select path old_path from public.post_images where post_id=saved_id
        union select thumb_path from public.post_images where post_id=saved_id
      ) old_images
      where not exists (
        select 1 from jsonb_array_elements(p_images) img
        where img->>'path'=old_path or img->>'thumb_path'=old_path
      ) on conflict do nothing;
    delete from public.post_images where post_id=saved_id;
  end if;
  insert into public.post_images(post_id,path,thumb_path,position)
    select saved_id,img->>'path',img->>'thumb_path',(ordinality-1)::smallint
    from jsonb_array_elements(p_images) with ordinality as images(img,ordinality);
  return saved_id;
end;
$$;
revoke execute on function public.save_post_with_images(bigint,smallint,text,text,text,text,jsonb,integer) from public,anon;
grant execute on function public.save_post_with_images(bigint,smallint,text,text,text,text,jsonb,integer) to authenticated;

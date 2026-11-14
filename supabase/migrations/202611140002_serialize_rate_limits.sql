-- 같은 작성자의 동시 INSERT도 한도 검사와 삽입을 순서대로 수행한다.
-- NO KEY UPDATE는 FK 검사(KEY SHARE)와 호환되므로 다른 사용자의 알림을 막지 않는다.
create or replace function public.posts_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('role', true) = 'authenticated' then
    perform 1 from public.profiles where id = new.author_id for no key update;
    if (
      select count(*) from public.posts
      where author_id = new.author_id and created_at > now() - interval '10 minutes'
    ) >= 5 then
      raise exception '잠시 후 다시 시도해 주세요';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.comments_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('role', true) = 'authenticated' then
    perform 1 from public.profiles where id = new.author_id for no key update;
    if (
      select count(*) from public.comments
      where author_id = new.author_id and created_at > now() - interval '1 minute'
    ) >= 10 then
      raise exception '잠시 후 다시 시도해 주세요';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.posts_rate_limit(), public.comments_rate_limit() from public, anon, authenticated;

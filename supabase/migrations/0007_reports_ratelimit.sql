-- 신고: 처리는 Supabase 대시보드에서 수동. 자동 숨김 없음.
create table public.reports (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id bigint not null,
  reporter_id uuid not null references public.profiles(id),
  reason text not null check (reason in ('스팸', '욕설', '음란', '저작권', '기타')),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (target_type, target_id, reporter_id, reason) on public.reports to authenticated;
grant usage on sequence public.reports_id_seq to authenticated;
create policy reports_read_own on public.reports for select to authenticated
  using (reporter_id = auth.uid());
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- target_id는 두 테이블을 가리키므로 FK 대신 트리거로 존재를 확인한다.
create function public.reports_check_target()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'post' then
    perform 1 from public.posts where id = new.target_id and deleted_at is null;
  else
    perform 1 from public.comments where id = new.target_id and deleted_at is null;
  end if;
  if not found then
    raise exception '신고 대상이 없습니다' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke execute on function public.reports_check_target() from public, anon, authenticated;
create trigger reports_check_target before insert on public.reports
  for each row execute function public.reports_check_target();

-- 도배 방지. 로그인 사용자(authenticated) 요청에만 적용한다.
-- 대시보드·시드처럼 관리자 권한으로 넣는 행은 제한하지 않는다.
create function public.posts_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('role', true) = 'authenticated' and (
    select count(*) from public.posts
    where author_id = new.author_id and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception '잠시 후 다시 시도해 주세요';
  end if;
  return new;
end;
$$;
revoke execute on function public.posts_rate_limit() from public, anon, authenticated;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.posts_rate_limit();

create function public.comments_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('role', true) = 'authenticated' and (
    select count(*) from public.comments
    where author_id = new.author_id and created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception '잠시 후 다시 시도해 주세요';
  end if;
  return new;
end;
$$;
revoke execute on function public.comments_rate_limit() from public, anon, authenticated;
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.comments_rate_limit();

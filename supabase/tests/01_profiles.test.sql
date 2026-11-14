begin;
\ir _helpers.sql
select plan(10);

create temporary table profile_users (label text, id uuid);
insert into profile_users values ('A', tests.create_user('타이거즈팬'));
insert into profile_users values ('B', tests.create_user('엘지팬'));
grant select on profile_users to anon, authenticated;

select is((select count(*) from public.profiles p join profile_users u on p.id = u.id
  where u.label = 'A' and p.nickname = '타이거즈팬'), 1::bigint, '가입 시 같은 id와 닉네임의 프로필 생성');
select throws_ok($$select tests.create_user('가')$$, '23514', null, '1자 닉네임 거부');
select throws_ok($$select tests.create_user(repeat('가', 13))$$, '23514', null, '13자 닉네임 거부');
select throws_ok($$select tests.create_user('타이거즈팬')$$, '23505', null, '중복 닉네임 거부');
select is((select count(*) from auth.users where raw_user_meta_data->>'nickname' = '타이거즈팬'),
  1::bigint, '중복 가입 시 auth.users도 롤백');

select tests.login_as((select id from profile_users where label = 'A'));
with changed as (
  update public.profiles set nickname = '변경시도' where id = (select id from profile_users where label = 'B') returning id
)
select is((select count(*) from changed), 0::bigint, '남의 프로필 수정은 영향 행 0');
select lives_ok($$update public.profiles set nickname = '기아팬' where id = (select id from profile_users where label = 'A')$$,
  '본인 닉네임 수정 허용');
select is((select nickname from public.profiles where id = (select id from profile_users where label = 'A')),
  '기아팬', '본인 수정 저장됨');
select throws_ok($$update public.profiles set created_at = now()$$, '42501', null, '닉네임 외 컬럼 수정 금지');

select tests.logout();
select is((select count(*) from public.profiles p join profile_users u on p.id = u.id), 2::bigint, '비회원 프로필 읽기 허용');
select * from finish();
rollback;

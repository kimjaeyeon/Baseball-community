begin;
\ir _helpers.sql
select plan(23);

create temporary table rr_users(label text, id uuid);
insert into rr_users values ('A', tests.create_user('신고자에이')), ('B', tests.create_user('신고자비'));
create temporary table rr_posts(label text, id bigint);
with p as (insert into public.posts(board_id,author_id,kind,title,body)
  select 1,id,'text','신고 대상 글','본문' from rr_users where label='B' returning id)
insert into rr_posts select 'target', id from p;
create temporary table rr_comments(id bigint);
with c as (insert into public.comments(post_id,author_id,body)
  select p.id,u.id,'신고 대상 댓글' from rr_posts p,rr_users u where u.label='B' returning id)
insert into rr_comments select id from c;
grant select on rr_users, rr_posts, rr_comments to anon, authenticated, service_role;

-- 신고
select tests.login_as((select id from rr_users where label='A'));
select lives_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'post',id,(select id from rr_users where label='A'),'스팸' from rr_posts$$, 'report post');
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'post',id,(select id from rr_users where label='A'),'욕설' from rr_posts$$, '23505', null, 'duplicate report rejected');
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'post',id,(select id from rr_users where label='B'),'스팸' from rr_posts$$, '42501', null, 'cannot report as someone else');
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'post',id,(select id from rr_users where label='A'),'아무거나' from rr_posts$$, '23514', null, 'unknown reason rejected');
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  values ('post',-1,(select id from rr_users where label='A'),'스팸')$$, '23503', null, 'missing target rejected');
select is((select count(*) from public.reports), 1::bigint, 'reporter sees own report');
select lives_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'comment',id,(select id from rr_users where label='A'),'욕설' from rr_comments$$, 'report active comment');
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  values ('comment',-1,(select id from rr_users where label='A'),'스팸')$$, '23503', null, 'missing comment rejected');
select throws_ok($$update public.reports set reason='기타'$$, '42501', null, 'reports immutable');

select tests.login_as((select id from rr_users where label='B'));
select is((select count(*) from public.reports), 0::bigint, 'cannot see others reports');
select lives_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'post',id,(select id from rr_users where label='B'),'기타' from rr_posts$$, 'author may report own post (no special case)');

select tests.logout();
select throws_ok($$select * from public.reports$$, '42501', null, 'anon cannot read reports');
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'post',id,(select id from rr_users where label='A'),'스팸' from rr_posts$$, '42501', null, 'anon cannot report');

-- 글 rate limit: 10분에 5개
select tests.login_as((select id from rr_users where label='A'));
select lives_ok($$insert into public.posts(board_id,author_id,kind,title,body)
  select 1,(select id from rr_users where label='A'),'text','도배 '||n,'본문' from generate_series(1,5) n$$, 'five posts allowed');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body)
  values (1,(select id from rr_users where label='A'),'text','도배 6','본문')$$, 'P0001', '잠시 후 다시 시도해 주세요', 'sixth post in 10 minutes rejected');

-- 댓글 rate limit: 1분에 10개
select lives_ok($$insert into public.comments(post_id,author_id,body)
  select (select id from rr_posts),(select id from rr_users where label='A'),'댓글 '||n from generate_series(1,10) n$$, 'ten comments allowed');
select throws_ok($$insert into public.comments(post_id,author_id,body)
  values ((select id from rr_posts),(select id from rr_users where label='A'),'댓글 11')$$, 'P0001', '잠시 후 다시 시도해 주세요', 'eleventh comment in 1 minute rejected');

-- 다른 사람은 영향 없음
select tests.login_as((select id from rr_users where label='B'));
select lives_ok($$insert into public.posts(board_id,author_id,kind,title,body)
  values (1,(select id from rr_users where label='B'),'text','다른 사람 글','본문')$$, 'other user unaffected');

-- 관리자(대시보드·시드) 삽입은 제한 없음
reset role;
select lives_ok($$insert into public.posts(board_id,author_id,kind,title,body)
  select 1,(select id from rr_users where label='A'),'text','시드 '||n,'본문' from generate_series(1,10) n$$, 'service inserts bypass rate limit');

set local role service_role;
select lives_ok($$insert into public.posts(board_id,author_id,kind,title,body)
  values (1,(select id from rr_users where label='A'),'text','서비스 역할 글','본문')$$, 'PostgREST service_role bypasses post rate limit');
select lives_ok($$insert into public.comments(post_id,author_id,body)
  values ((select id from rr_posts),(select id from rr_users where label='A'),'서비스 역할 댓글')$$, 'PostgREST service_role bypasses comment rate limit');

reset role;
update public.comments set deleted_at=now() where id in (select id from rr_comments);
update public.posts set deleted_at=now() where id in (select id from rr_posts);
select tests.login_as((select id from rr_users where label='A'));
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'comment',id,(select id from rr_users where label='A'),'스팸' from rr_comments$$, '23503', null, 'deleted comment rejected before duplicate handling');
select throws_ok($$insert into public.reports(target_type,target_id,reporter_id,reason)
  select 'post',id,(select id from rr_users where label='A'),'스팸' from rr_posts$$, '23503', null, 'deleted post rejected before duplicate handling');

select * from finish();
rollback;

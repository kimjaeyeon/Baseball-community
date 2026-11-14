begin;
\ir _helpers.sql
select plan(30);

create temporary table post_users (label text, id uuid);
insert into post_users values ('A', tests.create_user('글쓴이A')), ('B', tests.create_user('글쓴이B'));
grant select on post_users to anon, authenticated;
select is((select count(*) from public.boards), 3::bigint, '게시판 시드 3개');
select tests.login_as((select id from post_users where label = 'A'));
select lives_ok($$insert into public.posts(board_id, author_id, kind, title, body)
 values(1, (select id from post_users where label='A'), 'text', '본문 글', '본문')$$, '본인 본문 작성');
select lives_ok($$insert into public.posts(board_id, author_id, kind, title, url)
 values(2, (select id from post_users where label='A'), 'link', '링크 글', 'https://example.com')$$, '본인 링크 작성');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title)
 values(1,(select id from post_users where label='A'),'link','링크')$$, '23514', null, '링크 URL 필수');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title)
 values(1,(select id from post_users where label='A'),'text','본문')$$, '23514', null, '본문 필수');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,url)
 values(1,(select id from post_users where label='A'),'link','링크','javascript:alert(1)')$$, '23514', null, '위험한 URL 거부');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body)
 values(1,(select id from post_users where label='A'),'text','가','본문')$$, '23514', null, '제목 1자 거부');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body)
 values(1,(select id from post_users where label='A'),'text',repeat('가',101),'본문')$$, '23514', null, '제목 101자 거부');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body)
 values(1,(select id from post_users where label='A'),'text','제목','')$$, '23514', null, '빈 본문 거부');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body)
 values(1,(select id from post_users where label='A'),'text','제목',repeat('가',20001))$$, '23514', null, '본문 길이 제한');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body,url)
 values(1,(select id from post_users where label='A'),'link','제목',repeat('가',2001),'http://example.com')$$, '23514', null, '링크 코멘트 길이 제한');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body,url)
 values(1,(select id from post_users where label='A'),'text','제목','본문','https://example.com')$$, '23514', null, '본문 글 URL 거부');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body)
 values(1,(select id from post_users where label='B'),'text','위조 글','본문')$$, '42501', null, '작성자 위조 거부');
select throws_ok($$update public.posts set like_count=999$$, '42501', null, '추천 수 변경 거부');
select throws_ok($$update public.posts set comment_count=999$$, '42501', null, '댓글 수 변경 거부');
select throws_ok($$update public.posts set view_count=999$$, '42501', null, '조회 수 변경 거부');
select throws_ok($$update public.posts set is_best=true$$, '42501', null, '베스트 변경 거부');
select throws_ok($$update public.posts set best_at=now()$$, '42501', null, '승격 시각 변경 거부');
select throws_ok($$update public.posts set author_id=(select id from post_users where label='B')$$, '42501', null, '작성자 변경 거부');
select throws_ok($$update public.posts set deleted_at=now()$$, '42501', null, '직접 삭제 거부');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body,like_count)
 values(1,(select id from post_users where label='A'),'text','제목','본문',999)$$, '42501', null, '작성 시 카운트 위조 거부');
select lives_ok($$update public.posts set title='수정한 글' where kind='text'$$, '본인 수정 허용');
select tests.login_as((select id from post_users where label='B'));
with changed as (update public.posts set title='남의 글 수정' returning id)
select is((select count(*) from changed),0::bigint,'남의 글 수정은 0행');
select throws_ok($$select public.soft_delete_post((select id from public.posts where kind='text'))$$, '42501', null, '남의 글 삭제 거부');
select tests.login_as((select id from post_users where label='A'));
select lives_ok($$select public.soft_delete_post((select id from public.posts where kind='text'))$$, '본인 삭제 허용');
select tests.logout();
select is((select count(*) from public.posts where kind='text'),0::bigint,'삭제 글 비회원에게 숨김');
select is((select count(*) from public.posts where kind='link'),1::bigint,'비회원 읽기 허용');
select throws_ok($$insert into public.posts(board_id,author_id,kind,title,body)
 values(1,(select id from post_users where label='A'),'text','비회원 글','본문')$$, '42501', null, '비회원 작성 거부');
select throws_ok($$insert into public.boards values(4,'new','새 게시판',4)$$, '42501', null, '게시판 작성 거부');
reset role;
select is((select count(*) from public.posts where deleted_at is not null),1::bigint,'소프트 삭제 행 보존');
select * from finish();
rollback;

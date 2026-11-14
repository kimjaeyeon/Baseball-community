begin;
\ir _helpers.sql
select plan(29);
select has_table('public', 'post_images', 'image table exists');
create temporary table image_users as select tests.create_user('사진작성자') a, tests.create_user('사진다른팬') b;
create temporary table image_posts as
  with p as (insert into public.posts(board_id,author_id,kind,title,body) select 1,a,'text','사진 테스트','본문' from image_users returning id)
  select id from p;
grant select on image_users,image_posts to anon,authenticated;
select tests.login_as((select b from image_users));
select throws_ok($$insert into public.post_images(post_id,path,thumb_path,position) select p.id,u.b||'/x.webp',u.b||'/x_t.webp',0 from image_posts p,image_users u$$,'42501',null,'cannot attach to another post');
select tests.login_as((select a from image_users));
select throws_ok($$insert into storage.objects(bucket_id,name) select 'post-images',b||'/x.webp' from image_users$$,'42501',null,'cannot upload in another folder');
select lives_ok($$insert into storage.objects(bucket_id,name) select 'post-images',a||'/x.webp' from image_users$$,'own upload allowed');
insert into storage.objects(bucket_id,name) select 'post-images',a||'/x_t.webp' from image_users;
select lives_ok($$insert into public.post_images(post_id,path,thumb_path,position) select p.id,u.a||'/x.webp',u.a||'/x_t.webp',0 from image_posts p,image_users u$$,'own attachment allowed');
select throws_ok($$insert into public.post_images(post_id,path,thumb_path,position) select p.id,u.b||'/x.webp',u.b||'/x_t.webp',1 from image_posts p,image_users u$$,'42501',null,'cannot attach another folder');
select throws_ok($$insert into public.post_images(post_id,path,thumb_path,position) select p.id,u.a||'/x.webp',u.a||'/x_t.webp',10 from image_posts p,image_users u$$,'23514',null,'position limits attachments to ten');
select lives_ok($$select public.save_post_with_images((select id from image_posts),1::smallint,'text','수정 사진','본문',null,jsonb_build_array(jsonb_build_object('path',(select a from image_users)||'/x.webp','thumb_path',(select a from image_users)||'/x_t.webp')),0)$$,'atomic image edit');
select is((select thumb_path from public.posts where id=(select id from image_posts)),(select a::text||'/x_t.webp' from image_users),'representative thumb stored');
select throws_ok($$select public.save_post_with_images((select id from image_posts),1::smallint,'text','롤백 제목','본문',null,jsonb_build_array(jsonb_build_object('path',(select a from image_users)||'/x.webp','thumb_path',(select a from image_users)||'/x_t.webp'),jsonb_build_object('path',(select a from image_users)||'/x.webp','thumb_path',(select a from image_users)||'/x_t.webp')),0)$$,'23505',null,'insert failure after post update rolls back');
select is((select title from public.posts where id=(select id from image_posts)),'수정 사진','insert failure restores title');
select is((select thumb_path from public.posts where id=(select id from image_posts)),(select a::text||'/x_t.webp' from image_users),'insert failure restores thumb');
select is((select count(*) from public.post_images where post_id=(select id from image_posts)),1::bigint,'insert failure restores attachments');
select throws_ok($$select public.save_post_with_images((select id from image_posts),1::smallint,'text','실패 제목','본문',null,'[]',1)$$,'23514',null,'invalid representative rejected');
select is((select title from public.posts where id=(select id from image_posts)),'수정 사진','failed save keeps old title');
select throws_ok($$select public.save_post_with_images((select id from image_posts),1::smallint,'text','없는 사진','본문',null,jsonb_build_array(jsonb_build_object('path',(select a from image_users)||'/missing.webp','thumb_path',(select a from image_users)||'/missing_t.webp')),0)$$,'23514',null,'unuploaded image rejected');
select is((select count(*) from public.post_images where post_id=(select id from image_posts)),1::bigint,'failed save preserves images');
select throws_ok($$select public.save_post_with_images(null,1::smallint,'link','링크 사진','', 'https://example.com',jsonb_build_array(jsonb_build_object('path',(select a from image_users)||'/x.webp','thumb_path',(select a from image_users)||'/x_t.webp')),0)$$,'23514',null,'link cannot attach photos');
insert into storage.objects(bucket_id,name) select 'post-images',a||'/new.webp' from image_users
union all select 'post-images',a||'/new_t.webp' from image_users;
select lives_ok($$select public.save_post_with_images(null,1::smallint,'text','새 사진 글','본문',null,jsonb_build_array(jsonb_build_object('path',(select a from image_users)||'/new.webp','thumb_path',(select a from image_users)||'/new_t.webp')),0)$$,'create with images');
select tests.login_as((select b from image_users));
select throws_ok($$select public.save_post_with_images((select id from image_posts),1::smallint,'text','도용 수정','본문',null,'[]',0)$$,'42501',null,'cannot save another post');
with d as (delete from public.post_images where post_id=(select id from image_posts) returning *) select is((select count(*) from d),0::bigint,'cannot delete another attachment');
select tests.login_as((select a from image_users));
select lives_ok($$select public.save_post_with_images((select id from image_posts),1::smallint,'text','사진 제거','본문',null,'[]',0)$$,'remove all images');
select is((select thumb_path from public.posts where id=(select id from image_posts)),null::text,'removing clears representative');
select is((select count(*) from public.post_image_cleanup),2::bigint,'original and thumb cleanup persist after save');
select tests.login_as((select b from image_users));
select is((select count(*) from public.post_image_cleanup),0::bigint,'cleanup queue is private');
with d as (delete from public.post_image_cleanup returning *) select is((select count(*) from d),0::bigint,'cannot erase another cleanup job');
select tests.logout();
select is((select count(*) from public.post_images where path like (select a::text||'/%' from image_users)),1::bigint,'public reads attachments');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('post-images','anon/x.webp')$$,'42501',null,'anonymous upload forbidden');
reset role;
select is((select public from storage.buckets where id='post-images'),true,'bucket publicly serves files');
select * from finish();
rollback;

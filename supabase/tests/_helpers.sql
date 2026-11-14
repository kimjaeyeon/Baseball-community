create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(nickname text)
returns uuid
language plpgsql
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, raw_user_meta_data)
  values (uid, jsonb_build_object('nickname', nickname));
  return uid;
end;
$$;

create or replace function tests.login_as(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
end;
$$;

create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

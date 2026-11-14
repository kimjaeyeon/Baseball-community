insert into public.boards (id, slug, name, sort) values
  (1, 'kbo', 'KBO', 1),
  (2, 'mlb', 'MLB', 2),
  (3, 'free', '자유', 3)
on conflict (id) do nothing;

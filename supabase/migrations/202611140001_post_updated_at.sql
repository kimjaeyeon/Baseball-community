-- Activity counters, promotion and soft deletion do not edit post content.
drop trigger posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update of board_id, title, body, url, thumb_path on public.posts
  for each row execute function public.touch_post_updated_at();

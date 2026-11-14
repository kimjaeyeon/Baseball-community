import "server-only";

import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor } from "@/lib/cursor";

export type PostListItem = {
  id: number;
  board: { slug: string; name: string };
  kind: "text" | "link";
  title: string;
  url: string | null;
  thumb_path: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  is_best: boolean;
  created_at: string;
  author: { nickname: string };
};
export type PostDetail = PostListItem & { body: string | null; author_id: string; board_id: number; updated_at: string };
const listColumns = "id,kind,title,url,thumb_path,like_count,comment_count,view_count,is_best,created_at,best_at,board:boards!posts_board_id_fkey!inner(slug,name),author:profiles!posts_author_id_fkey(nickname)";

export async function listPosts(opts: { board?: string; best?: boolean; cursor?: string }): Promise<{ items: PostListItem[]; nextCursor: string | null }> {
  const supabase = await createClient();
  const key = opts.best ? "best_at" : "created_at";
  let query = supabase.from("posts").select(listColumns).is("deleted_at", null)
    .order(key, { ascending: false }).order("id", { ascending: false }).limit(21);
  if (opts.board) query = query.eq("board.slug", opts.board);
  if (opts.best) query = query.eq("is_best", true).not("best_at", "is", null);
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) query = query.or(`${key}.lt.${cursor.at},and(${key}.eq.${cursor.at},id.lt.${cursor.id})`);
  const { data, error } = await query.returns<(PostListItem & { best_at: string | null })[]>();
  if (error) throw new Error("글 목록을 불러오지 못했습니다", { cause: error });
  const items = data.slice(0, 20);
  const last = items.at(-1);
  return { items, nextCursor: data.length > 20 && last ? encodeCursor(opts.best ? last.best_at! : last.created_at, last.id) : null };
}

export async function getPost(id: number): Promise<PostDetail | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("posts").select(`${listColumns},body,author_id,board_id,updated_at`)
    .eq("id", id).is("deleted_at", null).maybeSingle<PostDetail>();
  if (error) throw new Error("글을 불러오지 못했습니다", { cause: error });
  return data;
}

export async function getBoard(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("boards").select("id,slug,name").eq("slug", slug).maybeSingle();
  if (error) throw new Error("게시판을 불러오지 못했습니다", { cause: error });
  return data as { id: number; slug: string; name: string } | null;
}

"use server";

import { listPosts } from "@/lib/posts";

// Public pagination is the only read exposed as a client-callable action.
export async function loadMorePosts(opts: { board?: string; best?: boolean; cursor?: string }) {
  return listPosts(opts);
}

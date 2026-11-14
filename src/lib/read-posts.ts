export function readPost(id: number): boolean {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem("readPosts") ?? "[]");
    return Array.isArray(ids) && ids.includes(id);
  } catch { return false; }
}

export function markPostRead(id: number): void {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("readPosts") ?? "[]");
    const ids = Array.isArray(stored) ? stored.filter((value) => Number.isSafeInteger(value) && value !== id) : [];
    localStorage.setItem("readPosts", JSON.stringify([...ids, id].slice(-1000)));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("readPosts"));
  } catch { /* Reading still works if storage is unavailable or full. */ }
}

export function subscribeReadPosts(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener("readPosts", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("readPosts", callback); };
}

export function encodeCursor(at: string, id: number): string {
  return Buffer.from(JSON.stringify({ at, id })).toString("base64url");
}

export function decodeCursor(s: string): { at: string; id: number } | null {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
    const value = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    // Strict timestamp syntax also prevents PostgREST filter injection.
    if (typeof value?.at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(value.at) ||
      !Number.isFinite(Date.parse(value.at)) || !Number.isSafeInteger(value.id) || value.id <= 0) return null;
    return { at: value.at, id: value.id };
  } catch {
    return null;
  }
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "방금";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  if (seconds <= 7 * 86400) return `${Math.floor(seconds / 86400)}일 전`;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date).replaceAll("-", ".");
}

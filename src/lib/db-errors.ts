// DB 트리거(posts_rate_limit, comments_rate_limit)가 던지는 문구와 같아야 한다.
export const RATE_LIMIT_MESSAGE = "잠시 후 다시 시도해 주세요";

export const REPORT_REASONS = ["스팸", "욕설", "음란", "저작권", "기타"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// DB 원문 메시지는 내부 구조를 드러내므로, 이용자에게 보여 줄 문구만 통과시킨다.
export function friendlyDbError(error: { message?: string } | null | undefined, fallback: string): string {
  return error?.message?.includes(RATE_LIMIT_MESSAGE) ? RATE_LIMIT_MESSAGE : fallback;
}

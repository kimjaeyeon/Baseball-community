export function validateNickname(s: string): string | null {
  const length = Array.from(s.trim()).length;
  return length >= 2 && length <= 12 ? null : "닉네임은 2~12자로 입력해 주세요";
}

export function validatePost(input: { kind: string; title: string; body: string; url: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  const length = (s: string) => Array.from(s).length;
  if (!["text", "link"].includes(input.kind)) errors.kind = "글 종류를 선택해 주세요";
  if (length(input.title.trim()) < 2 || length(input.title.trim()) > 100) errors.title = "제목은 2~100자로 입력해 주세요";
  if (input.kind === "text" && (length(input.body.trim()) < 1 || length(input.body.trim()) > 20000)) {
    errors.body = "본문은 1~20,000자로 입력해 주세요";
  }
  if (input.kind === "link") {
    if (length(input.body) > 2000) errors.body = "코멘트는 2,000자 이내로 입력해 주세요";
    try {
      const url = new URL(input.url);
      if (!/^https?:\/\//.test(input.url) || !["http:", "https:"].includes(url.protocol) || /\s/.test(input.url)) throw new Error();
    } catch {
      errors.url = "http:// 또는 https:// URL을 입력해 주세요";
    }
  }
  return errors;
}

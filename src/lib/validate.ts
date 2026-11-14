export function validateNickname(s: string): string | null {
  const length = Array.from(s.trim()).length;
  return length >= 2 && length <= 12 ? null : "닉네임은 2~12자로 입력해 주세요";
}

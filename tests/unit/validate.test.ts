import { describe, expect, it } from "vitest";
import { validateNickname } from "../../src/lib/validate";

describe("validateNickname", () => {
  it.each(["a", "가", "", "  ", "열세글자닉네임입니다요요요", "가".repeat(13)])("rejects invalid nickname %s", (nickname) => {
    expect(validateNickname(nickname)).toEqual(expect.any(String));
  });

  it.each(["엘지팬", "가나", "가".repeat(12), "열세글자닉네임입니다요요", "  엘지팬  "])("accepts trimmed nickname %s", (nickname) => {
    expect(validateNickname(nickname)).toBeNull();
  });
});

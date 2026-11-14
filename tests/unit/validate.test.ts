import { describe, expect, it } from "vitest";
import { validateNickname, validatePost } from "../../src/lib/validate";

describe("validateNickname", () => {
  it.each(["a", "가", "", "  ", "열세글자닉네임입니다요요요", "가".repeat(13)])("rejects invalid nickname %s", (nickname) => {
    expect(validateNickname(nickname)).toEqual(expect.any(String));
  });

  it.each(["엘지팬", "가나", "가".repeat(12), "열세글자닉네임입니다요요", "  엘지팬  "])("accepts trimmed nickname %s", (nickname) => {
    expect(validateNickname(nickname)).toBeNull();
  });
});

describe("validatePost", () => {
  const text = { kind: "text", title: "제목", body: "본문", url: "" };
  it.each(["ftp://x", "javascript:alert(1)", "https://", "https://x.invalid\n.bad"]) ("rejects unsafe or malformed URL %s", (url) => {
    expect(validatePost({ ...text, kind: "link", url })).toHaveProperty("url");
  });
  it("rejects blank text body", () => expect(validatePost({ ...text, body: " \n " })).toHaveProperty("body"));
  it.each(["가", "가".repeat(101)])("rejects invalid title length", (title) => {
    expect(validatePost({ ...text, title })).toHaveProperty("title");
  });
  it("rejects oversized body and comment", () => {
    expect(validatePost({ ...text, body: "가".repeat(20001) })).toHaveProperty("body");
    expect(validatePost({ ...text, kind: "link", url: "https://example.com", body: "가".repeat(2001) })).toHaveProperty("body");
  });
  it("accepts valid content including Unicode", () => {
    expect(validatePost({ ...text, title: "⚾".repeat(100), body: "a".repeat(20000) })).toEqual({});
    expect(validatePost({ ...text, kind: "link", body: "", url: "http://example.com" })).toEqual({});
  });
  it("rejects unknown kinds", () => expect(validatePost({ ...text, kind: "other" })).toHaveProperty("kind"));
});

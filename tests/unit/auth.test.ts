import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, maybeSingle } = vi.hoisted(() => ({
  auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

import { signIn, signOut, signUp } from "../../src/app/login/actions";

function form(nickname = "  엘지팬  ") {
  const data = new FormData();
  data.set("nickname", nickname);
  data.set("email", "fan@example.com");
  data.set("password", "test-password-123");
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("auth actions", () => {
  it("returns nickname validation errors before signup", async () => {
    expect(await signUp(form("가"))).toEqual({ error: expect.any(String) });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("shows the duplicate nickname message for an existing profile", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "existing" }, error: null });
    expect(await signUp(form())).toEqual({ error: "이미 쓰는 닉네임입니다" });
  });

  it("maps unique errors to the duplicate nickname message", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { message: "duplicate unique constraint" } });
    expect(await signUp(form())).toEqual({ error: "이미 쓰는 닉네임입니다" });
  });

  it("rechecks nickname after a generic trigger error to handle concurrent signup", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "concurrent" }, error: null });
    auth.signUp.mockResolvedValue({ data: {}, error: { message: "Database error saving new user" } });
    expect(await signUp(form())).toEqual({ error: "이미 쓰는 닉네임입니다" });
  });

  it("does not call every database failure a duplicate nickname", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { message: "Database error saving new user" } });
    expect(await signUp(form())).toEqual({ error: "가입하지 못했습니다. 잠시 후 다시 시도해 주세요" });
  });

  it("sends trimmed nickname metadata and redirects after signup", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
    await expect(signUp(form())).rejects.toThrow("REDIRECT");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "fan@example.com", password: "test-password-123", options: { data: { nickname: "엘지팬" } },
    });
  });

  it("returns a friendly signin error", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await signIn(form())).toEqual({ error: "이메일 또는 비밀번호를 확인해 주세요" });
  });

  it("redirects after signin", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn(form())).rejects.toThrow("REDIRECT");
  });

  it("returns errors on failed signout", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "failed" } });
    expect(await signOut()).toEqual({ error: "로그아웃하지 못했습니다. 다시 시도해 주세요" });
  });

  it("redirects after signout", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).rejects.toThrow("REDIRECT");
  });
});

import { expect, test, type Browser, type Page } from "@playwright/test";

// 핵심 루프: 가입 → 글쓰기 → 다른 계정 5개로 추천 → 홈 베스트 탭 → 글쓴이 알림
const run = Date.now().toString(36).slice(-5);

async function signUp(browser: Browser, label: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "회원가입" }).click();
  await page.getByLabel("이메일").fill(`e2e-${run}-${label}@example.com`);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByLabel("닉네임 (2~12자)").fill(`e2e${run}${label}`);
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByRole("navigation", { name: "주 메뉴" }).getByText(`e2e${run}${label}`)).toBeVisible();
  return page;
}

test("추천 5개를 받은 글이 베스트로 올라가고 글쓴이가 알림을 받는다", async ({ browser }) => {
  const author = await signUp(browser, "a");
  const title = `E2E 베스트 후보 ${run}`;
  await author.goto("/write");
  await author.getByLabel("게시판").selectOption("kbo");
  await author.getByLabel("제목 (2~100자)").fill(title);
  await author.getByLabel("본문 (마크다운, 1~20,000자)").fill("오늘 경기 **명장면** 정리");
  await author.getByRole("button", { name: "등록하기" }).click();
  await author.waitForURL(/\/kbo\/\d+$/);
  await expect(author.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const postUrl = author.url();

  // 본인 글은 추천 버튼이 비활성
  await expect(author.getByRole("button", { name: /추천 0/ })).toBeDisabled();

  for (const label of ["b", "c", "d", "e", "f"]) {
    const fan = await signUp(browser, label);
    await fan.goto(postUrl);
    const like = fan.getByRole("button", { name: /추천 \d+/ });
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await fan.context().close();
  }

  await author.goto("/?tab=best");
  await expect(author.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  await expect(author.getByLabel("안 읽은 알림 있음")).toBeVisible();
  await author.getByRole("link", { name: "알림·내 정보" }).click();
  await expect(author.getByText("베스트에 올랐어요")).toBeVisible();
});

test("남의 글을 신고하면 '신고됨'으로 바뀐다", async ({ browser }) => {
  const author = await signUp(browser, "r1");
  await author.goto("/write");
  await author.getByLabel("제목 (2~100자)").fill(`E2E 신고 대상 ${run}`);
  await author.getByLabel("본문 (마크다운, 1~20,000자)").fill("신고 테스트 본문");
  await author.getByRole("button", { name: "등록하기" }).click();
  await author.waitForURL(/\/[a-z]+\/\d+$/);
  await expect(author.getByRole("button", { name: "🚩 신고" })).toHaveCount(0);
  const postUrl = author.url();

  const reporter = await signUp(browser, "r2");
  await reporter.goto(postUrl);
  await reporter.getByRole("button", { name: "🚩 신고" }).click();
  await reporter.getByRole("button", { name: "스팸" }).click();
  await expect(reporter.getByText("🚩 신고됨")).toBeVisible();
  await reporter.reload();
  await expect(reporter.getByText("🚩 신고됨")).toBeVisible();
});

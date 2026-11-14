import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "../../src/components/Markdown";

it("renders markdown without executing raw HTML and secures external links", () => {
  const html = renderToStaticMarkup(Markdown({
    children: '**강조** <script>alert(1)</script> [원문](https://example.com) [위험](javascript:alert(1))',
  }));
  expect(html).toContain("<strong>강조</strong>");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer nofollow"');
});

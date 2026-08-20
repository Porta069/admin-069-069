"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee, requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { splitByConnection, getClient } from "@/lib/ads";
import { SnapchatAdsClient } from "@/lib/ads/snapchat";
import { syncAdsInsights } from "@/lib/ads/analytics";
import { CAMPAIGN_STATUS, type Provider } from "@/lib/ads/platforms";

export type ActionResult<T = object> =
  | ({ ok: true; message?: string } & T)
  | { ok: false; message: string };

export interface CampaignInput {
  id?: string | null;
  name: string;
  platforms: string[];
  ziel: string;
  dailyBudgetCents: number | null;
  totalBudgetCents: number | null;
  startDate: string | null;
  endDate: string | null;
  targeting: Record<string, unknown>;
  creativeId: string | null;
  primaertext: string | null;
  ueberschrift: string | null;
  beschreibung: string | null;
  cta: string | null;
  landingUrl: string | null;
  tracking: Record<string, unknown>;
}

const s = (v: unknown, max = 2000) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const intOrNull = (v: unknown) =>
  v == null || v === "" ? null : Math.max(0, Math.round(Number(v) || 0));

/** Kampagne als Entwurf speichern oder aktualisieren. */
export async function saveCampaign(input: CampaignInput): Promise<ActionResult<{ id: string }>> {
  try {
    const employee = await requirePermission("communication", "create");
    const name = s(input.name, 200);
    if (!name) return { ok: false, message: "Bitte einen Kampagnennamen angeben." };
    const platforms = Array.isArray(input.platforms) ? input.platforms.slice(0, 5) : [];
    if (platforms.length === 0) return { ok: false, message: "Bitte mindestens eine Plattform wählen." };

    if (input.id) {
      const rows = await sql`
        update admin.ads_campaign set
          name = ${name}, platforms = ${platforms}, ziel = ${s(input.ziel) ?? "REGISTRATIONS"},
          daily_budget_cents = ${intOrNull(input.dailyBudgetCents)},
          total_budget_cents = ${intOrNull(input.totalBudgetCents)},
          start_date = ${input.startDate || null}, end_date = ${input.endDate || null},
          targeting = ${sql.json((input.targeting ?? {}) as never)}, creative_id = ${input.creativeId || null},
          primaertext = ${s(input.primaertext, 4000)}, ueberschrift = ${s(input.ueberschrift, 300)},
          beschreibung = ${s(input.beschreibung, 2000)}, cta = ${s(input.cta) ?? "SIGN_UP"},
          landing_url = ${s(input.landingUrl)}, tracking = ${sql.json((input.tracking ?? {}) as never)},
          updated_at = now()
        where id = ${input.id} and deleted_at is null returning id`;
      if (rows.length === 0) return { ok: false, message: "Kampagne wurde nicht gefunden." };
      revalidatePath("/werbung/kampagnen");
      return { ok: true, id: rows[0].id as string, message: "Kampagne gespeichert." };
    }

    const [row] = await sql`
      insert into admin.ads_campaign
        (name, platforms, ziel, status, daily_budget_cents, total_budget_cents,
         start_date, end_date, targeting, creative_id, primaertext, ueberschrift,
         beschreibung, cta, landing_url, tracking, created_by)
      values (${name}, ${platforms}, ${s(input.ziel) ?? "REGISTRATIONS"}, 'DRAFT',
              ${intOrNull(input.dailyBudgetCents)}, ${intOrNull(input.totalBudgetCents)},
              ${input.startDate || null}, ${input.endDate || null},
              ${sql.json((input.targeting ?? {}) as never)}, ${input.creativeId || null},
              ${s(input.primaertext, 4000)}, ${s(input.ueberschrift, 300)},
              ${s(input.beschreibung, 2000)}, ${s(input.cta) ?? "SIGN_UP"},
              ${s(input.landingUrl)}, ${sql.json((input.tracking ?? {}) as never)}, ${employee.id})
      returning id`;
    await recordAudit({
      actorId: employee.id, action: "ads.campaign_created",
      entityType: "ads_campaign", entityId: row.id as string, metadata: { name, platforms },
    });
    revalidatePath("/werbung/kampagnen");
    return { ok: true, id: row.id as string, message: "Kampagne als Entwurf gespeichert." };
  } catch (e) {
    console.error("saveCampaign failed", e);
    return { ok: false, message: "Kampagne konnte nicht gespeichert werden." };
  }
}

/** Lokaler Statuswechsel (Pausieren/Aktivieren/Beenden). */
export async function setCampaignStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "edit");
    if (!Object.keys(CAMPAIGN_STATUS).includes(status)) {
      return { ok: false, message: "Unbekannter Status." };
    }
    const rows = await sql`
      update admin.ads_campaign set status = ${status}, updated_at = now()
      where id = ${id} and deleted_at is null returning id`;
    if (rows.length === 0) return { ok: false, message: "Kampagne wurde nicht gefunden." };
    await recordAudit({
      actorId: employee.id, action: "ads.status_changed",
      entityType: "ads_campaign", entityId: id, metadata: { status },
    });
    revalidatePath("/werbung/kampagnen");
    return { ok: true, message: "Status aktualisiert." };
  } catch (e) {
    console.error("setCampaignStatus failed", e);
    return { ok: false, message: "Status konnte nicht geändert werden." };
  }
}

export async function duplicateCampaign(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "create");
    const [c] = await sql`select * from admin.ads_campaign where id = ${id} and deleted_at is null`;
    if (!c) return { ok: false, message: "Kampagne wurde nicht gefunden." };
    await sql`
      insert into admin.ads_campaign
        (name, platforms, ziel, status, daily_budget_cents, total_budget_cents,
         start_date, end_date, targeting, creative_id, primaertext, ueberschrift,
         beschreibung, cta, landing_url, tracking, created_by)
      values (${`${c.name} (Kopie)`}, ${c.platforms}, ${c.ziel}, 'DRAFT',
              ${c.daily_budget_cents}, ${c.total_budget_cents}, ${c.start_date}, ${c.end_date},
              ${sql.json((c.targeting ?? {}) as never)}, ${c.creative_id}, ${c.primaertext},
              ${c.ueberschrift}, ${c.beschreibung}, ${c.cta}, ${c.landing_url},
              ${sql.json((c.tracking ?? {}) as never)}, ${employee.id})`;
    revalidatePath("/werbung/kampagnen");
    return { ok: true, message: "Kampagne dupliziert (als Entwurf)." };
  } catch (e) {
    console.error("duplicateCampaign failed", e);
    return { ok: false, message: "Kampagne konnte nicht dupliziert werden." };
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "delete");
    const rows = await sql`
      update admin.ads_campaign set deleted_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null returning id`;
    if (rows.length === 0) return { ok: false, message: "Kampagne wurde nicht gefunden." };
    await recordAudit({
      actorId: employee.id, action: "ads.campaign_deleted",
      entityType: "ads_campaign", entityId: id,
    });
    revalidatePath("/werbung/kampagnen");
    return { ok: true, message: "Kampagne gelöscht." };
  } catch (e) {
    console.error("deleteCampaign failed", e);
    return { ok: false, message: "Kampagne konnte nicht gelöscht werden." };
  }
}

/**
 * Veröffentlichen: nur wenn mindestens eine gewählte Plattform verbunden ist.
 * Ehrlich — solange die Live-Anbindung nicht freigeschaltet ist, bleibt die
 * Kampagne Entwurf und es wird klar gemeldet, dass keine echte Schaltung erfolgte.
 */
export async function publishCampaign(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "edit");
    const [c] = await sql`select * from admin.ads_campaign where id = ${id} and deleted_at is null`;
    if (!c) return { ok: false, message: "Kampagne wurde nicht gefunden." };
    const platforms = (c.platforms as string[]) ?? [];
    const { connected, notConnected } = splitByConnection(platforms);
    if (connected.length === 0) {
      return {
        ok: false,
        message:
          "Keine der gewählten Plattformen ist verbunden. Bitte zuerst unter „Verbindungen“ die Zugangsdaten hinterlegen. Die Kampagne bleibt als Entwurf gespeichert.",
      };
    }
    // Verbindung besteht. Die vollständige Live-Auslieferung (Anzeigengruppe mit
    // Budget/Zielgruppe + Creative + Anzeige) ist der nächste Ausbauschritt —
    // hier wird bewusst NICHTS geschaltet und nichts vorgetäuscht.
    return {
      ok: false,
      message:
        `Verbindung zu ${connected.map((p) => p).join(", ")} steht ✓. Die echte Auslieferung ` +
        `(Anzeigengruppe, Budget, Zielgruppe & Creative) wird als nächster Schritt aktiviert — ` +
        `die Kampagne bleibt vorerst Entwurf.` +
        (notConnected.length ? ` (nicht verbunden: ${notConnected.join(", ")})` : ""),
    };
  } catch (e) {
    console.error("publishCampaign failed", e);
    return { ok: false, message: "Veröffentlichung fehlgeschlagen." };
  }
}

// ── Creatives ───────────────────────────────────────────────────────────────

export async function createCreative(input: {
  name: string;
  typ: string;
  tags: string[];
  url?: string;
  aspectRatio?: string;
  notiz?: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "create");
    const name = s(input.name, 200);
    if (!name) return { ok: false, message: "Bitte einen Namen angeben." };
    await sql`
      insert into admin.ads_creative (name, typ, tags, url, aspect_ratio, notiz, created_by)
      values (${name}, ${input.typ === "VIDEO" ? "VIDEO" : "IMAGE"},
              ${(input.tags ?? []).slice(0, 20)}, ${s(input.url, 500)},
              ${s(input.aspectRatio, 20)}, ${s(input.notiz, 2000)}, ${employee.id})`;
    revalidatePath("/werbung/creatives");
    return { ok: true, message: "Creative angelegt." };
  } catch (e) {
    console.error("createCreative failed", e);
    return { ok: false, message: "Creative konnte nicht angelegt werden." };
  }
}

export async function deleteCreative(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "delete");
    await sql`update admin.ads_creative set deleted_at = now() where id = ${id} and deleted_at is null`;
    void employee;
    revalidatePath("/werbung/creatives");
    return { ok: true, message: "Creative gelöscht." };
  } catch (e) {
    console.error("deleteCreative failed", e);
    return { ok: false, message: "Creative konnte nicht gelöscht werden." };
  }
}

/** Live-Verbindungstest je Plattform (echter API-Call, keine Fake-Antwort). */
export async function testAdConnection(
  provider: Provider,
): Promise<ActionResult> {
  try {
    await requirePermission("communication", "edit");
    const client = getClient(provider);
    if (client instanceof SnapchatAdsClient) {
      const r = await client.testConnection();
      if (r.ok) {
        return {
          ok: true,
          message: `Verbunden mit „${r.accountName}" · ${r.currency} · Status ${r.status}${r.timezone ? ` · ${r.timezone}` : ""}.`,
        };
      }
      return { ok: false, message: r.message ?? "Verbindungstest fehlgeschlagen." };
    }
    return { ok: false, message: "Für diese Plattform ist der Live-Test noch nicht verfügbar." };
  } catch (e) {
    console.error("testAdConnection failed", e);
    return { ok: false, message: (e as Error).message || "Verbindungstest fehlgeschlagen." };
  }
}

/** Manueller Kennzahlen-Sync (überspringt nicht verbundene Plattformen ehrlich). */
export async function syncNow(): Promise<ActionResult<{ synced: number; uebersprungen: string[] }>> {
  try {
    await requirePermission("communication", "edit");
    const r = await syncAdsInsights();
    revalidatePath("/werbung");
    revalidatePath("/werbung/analytics");
    const msg = r.synced > 0
      ? `${r.synced} Datensätze synchronisiert.`
      : `Kein Sync möglich: ${r.uebersprungen.join(", ") || "keine verbundene Plattform"}.`;
    return { ok: true, message: msg, synced: r.synced, uebersprungen: r.uebersprungen };
  } catch (e) {
    console.error("syncNow failed", e);
    return { ok: false, message: "Sync fehlgeschlagen." };
  }
}

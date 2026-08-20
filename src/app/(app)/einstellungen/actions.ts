"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { verifyStepUp } from "@/lib/step-up";
import {
  DEFAULT_PRICING,
  readListValue,
  type ListSettingKey,
} from "./_components/setting-defaults";

const KNOWN_MESSAGES = new Set([
  "Nicht angemeldet.",
  "Keine Berechtigung für diese Aktion.",
]);

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && KNOWN_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

const LIST_KEYS: ListSettingKey[] = [
  "candidate_statuses",
  "company_statuses",
  "note_categories",
];

async function getSettingValue(key: string): Promise<unknown> {
  const rows = await sql`
    select value from admin.setting where key = ${key} limit 1`;
  return rows[0]?.value ?? null;
}

async function upsertSetting(key: string, value: unknown): Promise<void> {
  await sql`
    insert into admin.setting (key, value)
    values (${key}, ${sql.json(value as never)})
    on conflict (key) do update set value = excluded.value`;
}

/* ---------- Vergütung & Prämien ---------- */

export async function savePricing(input: {
  baseFeeCents: number;
  maxCommissionCents: number;
  referralRewardCents: number;
  provisionPercent: number;
  totpCode: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("settings", "edit");

    // Bezahl-Variablen sind sicherheitskritisch: zusätzlich 2FA-Code verlangen.
    const stepUp = await verifyStepUp(input.totpCode);
    if (!stepUp.ok) return { ok: false, message: stepUp.message };

    const values = [
      input.baseFeeCents,
      input.maxCommissionCents,
      input.referralRewardCents,
    ];
    if (
      values.some(
        (v) => !Number.isInteger(v) || v < 0 || v > 100_000_000,
      )
    ) {
      return {
        ok: false,
        message: "Bitte gültige, nicht-negative Beträge angeben.",
      };
    }
    const provisionPercent =
      Math.round((Number(input.provisionPercent) || 0) * 100) / 100;
    if (!Number.isFinite(provisionPercent) || provisionPercent < 0 || provisionPercent > 100) {
      return { ok: false, message: "Der Prozentsatz muss zwischen 0 und 100 liegen." };
    }

    const current = (await getSettingValue("pricing")) ?? DEFAULT_PRICING;
    const next = {
      base_fee_cents: input.baseFeeCents,
      max_commission_cents: input.maxCommissionCents,
      referral_reward_cents: input.referralRewardCents,
      provision_percent: provisionPercent,
    };
    await upsertSetting("pricing", next);

    await recordAudit({
      actorId: actor.id,
      action: "settings.pricing_changed",
      entityType: "setting",
      entityId: "pricing",
      metadata: { from: current as Record<string, unknown>, to: next },
    });

    revalidatePath("/einstellungen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Vergütung konnte nicht gespeichert werden."),
    };
  }
}

/* ---------- Listen (Pipeline, Kategorien, Unternehmens-Status) ---------- */

function normalizeValue(key: ListSettingKey, raw: string): string {
  const trimmed = raw.trim().slice(0, 40);
  if (key === "note_categories") return trimmed;
  return trimmed
    .toUpperCase()
    .replace(/[ÄÖÜ]/g, (c) => ({ Ä: "AE", Ö: "OE", Ü: "UE" })[c] ?? c)
    .replace(/ß/g, "SS")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function addSettingListValue(
  key: ListSettingKey,
  rawValue: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("settings", "edit");
    if (!LIST_KEYS.includes(key)) {
      return { ok: false, message: "Unbekannte Einstellung." };
    }
    const value = normalizeValue(key, rawValue);
    if (!value) {
      return { ok: false, message: "Bitte einen Wert eingeben." };
    }

    const current = readListValue(await getSettingValue(key), key);
    if (current.includes(value)) {
      return { ok: false, message: `„${value}" existiert bereits.` };
    }

    const next = [...current, value];
    await upsertSetting(key, next);
    await recordAudit({
      actorId: actor.id,
      action: "settings.list_changed",
      entityType: "setting",
      entityId: key,
      metadata: { added: value, values: next },
    });

    revalidatePath("/einstellungen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Wert konnte nicht hinzugefügt werden."),
    };
  }
}

async function countUsage(key: ListSettingKey, value: string): Promise<number> {
  if (key === "candidate_statuses") {
    const [row] = await sql`
      select count(*)::int as count from admin.candidate_meta
      where status = ${value}`;
    return row.count as number;
  }
  if (key === "company_statuses") {
    const [row] = await sql`
      select count(*)::int as count from admin.company_meta
      where status = ${value}`;
    return row.count as number;
  }
  const [row] = await sql`
    select count(*)::int as count from admin.note
    where category = ${value} and deleted_at is null`;
  return row.count as number;
}

const USAGE_LABEL: Record<ListSettingKey, string> = {
  candidate_statuses: "Kandidaten",
  company_statuses: "Unternehmen",
  note_categories: "Notizen",
};

export async function removeSettingListValue(
  key: ListSettingKey,
  value: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("settings", "edit");
    if (!LIST_KEYS.includes(key)) {
      return { ok: false, message: "Unbekannte Einstellung." };
    }

    const current = readListValue(await getSettingValue(key), key);
    if (!current.includes(value)) {
      return { ok: false, message: "Der Wert wurde nicht gefunden." };
    }
    if (current.length <= 1) {
      return {
        ok: false,
        message: "Der letzte Wert der Liste kann nicht entfernt werden.",
      };
    }

    const usage = await countUsage(key, value);
    if (usage > 0) {
      return {
        ok: false,
        message: `„${value}" wird noch von ${usage} ${USAGE_LABEL[key]} verwendet und kann nicht entfernt werden.`,
      };
    }

    const next = current.filter((v) => v !== value);
    await upsertSetting(key, next);
    await recordAudit({
      actorId: actor.id,
      action: "settings.list_changed",
      entityType: "setting",
      entityId: key,
      metadata: { removed: value, values: next },
    });

    revalidatePath("/einstellungen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Wert konnte nicht entfernt werden."),
    };
  }
}

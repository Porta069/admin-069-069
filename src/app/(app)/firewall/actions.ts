"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  invalidiereFirewallCache,
  aktuelleClientIp,
} from "@/lib/firewall-server";

type Result = { ok: true } | { ok: false; message: string };

async function superadmin() {
  const employee = await requireEmployee();
  if (employee.roleId !== "SUPERADMIN") {
    throw new Error("Nur für das Master-Konto.");
  }
  return employee;
}

// Grobe, aber ausreichende Prüfung: IPv4/IPv6 oder Präfix mit Punkt am Ende.
function ipMusterOk(p: string): boolean {
  if (/^(\d{1,3}\.){1,3}$/.test(p)) return true; // Präfix z. B. 203.0.113.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(p)) return true; // IPv4
  if (/^[0-9a-fA-F:]+$/.test(p) && p.includes(":")) return true; // IPv6 (grob)
  return false;
}

export async function addFirewallRule(input: {
  ruleType: "BLOCK_IP" | "ALLOW_IP";
  pattern: string;
  note?: string;
}): Promise<Result> {
  try {
    const employee = await superadmin();
    const pattern = (input.pattern ?? "").trim();
    if (!ipMusterOk(pattern)) {
      return { ok: false, message: "Bitte eine gültige IP oder ein Präfix (z. B. 203.0.113.) angeben." };
    }
    if (!["BLOCK_IP", "ALLOW_IP"].includes(input.ruleType)) {
      return { ok: false, message: "Ungültiger Regeltyp." };
    }
    // Selbstsperre verhindern: die eigene aktuelle IP nicht blockieren.
    if (input.ruleType === "BLOCK_IP") {
      const meineIp = await aktuelleClientIp();
      if (meineIp && (meineIp === pattern || (pattern.endsWith(".") && meineIp.startsWith(pattern)))) {
        return { ok: false, message: "Diese Regel würde deine eigene IP sperren — abgelehnt." };
      }
    }
    await sql`
      insert into admin.firewall_rule (rule_type, pattern, note, created_by)
      values (${input.ruleType}, ${pattern}, ${(input.note ?? "").trim().slice(0, 200) || null}, ${employee.id})
      on conflict (rule_type, pattern) where deleted_at is null
      do update set enabled = true, note = excluded.note`;
    invalidiereFirewallCache();
    await recordAudit({
      actorId: employee.id,
      action: "firewall.rule_added",
      entityType: "firewall_rule",
      metadata: { ruleType: input.ruleType, pattern },
    });
    revalidatePath("/firewall");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: e instanceof Error ? e.message : "Regel konnte nicht angelegt werden." };
  }
}

export async function deleteFirewallRule(id: string): Promise<Result> {
  try {
    const employee = await superadmin();
    await sql`
      update admin.firewall_rule set deleted_at = now(), enabled = false
      where id = ${id}::uuid and deleted_at is null`;
    invalidiereFirewallCache();
    await recordAudit({
      actorId: employee.id,
      action: "firewall.rule_deleted",
      entityType: "firewall_rule",
      entityId: id,
    });
    revalidatePath("/firewall");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Regel konnte nicht gelöscht werden." };
  }
}

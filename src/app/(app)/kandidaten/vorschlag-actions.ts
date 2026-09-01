"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { adminCreateSuggestions, BackendError } from "@/lib/backend";

/**
 * Kandidatenvorschläge an einen Betrieb — ausschließlich über den Admin-Endpunkt
 * (POST /employer/admin/suggestions). Der Endpunkt frischt Vorhandene auf statt
 * zu verdoppeln, überspringt Abgelehnte und weist unbekannte/inaktive userIds
 * bzw. eine fremde jobPostingId mit 400 ab (nichts wird angelegt).
 */

/** Stellen eines Betriebs für die optionale Zuordnung (Lesen erlaubt). */
export async function jobsFuerBetrieb(
  companyId: string,
): Promise<{ id: string; title: string }[]> {
  if (!companyId) return [];
  await requirePermission("placements", "create");
  const rows = await sql<{ id: string; title: string }[]>`
    select id, title from public."JobPosting"
    where "companyId" = ${companyId} and status <> 'ARCHIVED'
    order by "createdAt" desc limit 100`;
  return rows.map((r) => ({ id: r.id, title: r.title }));
}

export async function kandidatenVorschlagen(input: {
  companyId: string;
  userIds: string[];
  jobPostingId?: string | null;
  begruendung?: string | null;
}): Promise<
  | { ok: true; angelegt: number; aufgefrischt: number; uebersprungen: number }
  | { ok: false; message: string }
> {
  try {
    const employee = await requirePermission("placements", "create");
    if (!input.companyId) return { ok: false, message: "Bitte einen Betrieb wählen." };
    const userIds = [...new Set(input.userIds.filter(Boolean))];
    if (userIds.length === 0) {
      return { ok: false, message: "Bitte mindestens einen Kandidaten wählen." };
    }

    const res = await adminCreateSuggestions({
      companyId: input.companyId,
      userIds,
      jobPostingId: input.jobPostingId || undefined,
      begruendung: input.begruendung?.trim() || undefined,
      quelle: "ADMIN",
    });

    await recordAudit({
      actorId: employee.id,
      action: "suggestion.created",
      entityType: "company",
      entityId: input.companyId,
      metadata: {
        userIds: userIds.length,
        jobPostingId: input.jobPostingId ?? null,
        angelegt: res.angelegt,
        aufgefrischt: res.aufgefrischt,
        uebersprungen: res.uebersprungen,
      },
    });
    revalidatePath("/unternehmen");
    revalidatePath(`/unternehmen/${input.companyId}`);
    return { ok: true, ...res };
  } catch (e) {
    if (e instanceof BackendError) {
      return {
        ok: false,
        message:
          e.status === 401 || e.status === 403
            ? "Backend-Zugriff nicht autorisiert — ADMIN_API_KEY prüfen."
            : e.message,
      };
    }
    console.error("kandidatenVorschlagen failed", e);
    return { ok: false, message: "Vorschlagen fehlgeschlagen (Backend nicht erreichbar?)." };
  }
}

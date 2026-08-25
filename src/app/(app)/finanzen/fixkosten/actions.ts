"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  DOCUMENT_MAX_BYTES,
  uploadDocument,
  deleteDocumentObject,
  createSignedDocumentUrl,
} from "@/lib/storage";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const KIND = new Set(["LAUFEND", "EINMALIG"]);
const INTERVALL = new Set(["MONTHLY", "YEARLY"]);
const BELEG_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** „1.234,56" / „1234.56" / „1234" → Cents (ganzzahlig). */
function euroZuCents(input: string): number | null {
  const s = (input ?? "").trim().replace(/\s|€/g, "").replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function createFixedCost(formData: FormData): Promise<Result> {
  try {
    const employee = await requirePermission("rewards", "create");

    const bezeichnung = String(formData.get("bezeichnung") ?? "").trim().slice(0, 160);
    if (!bezeichnung) return { ok: false, message: "Bitte eine Bezeichnung angeben." };

    const kind = String(formData.get("kind") ?? "LAUFEND");
    if (!KIND.has(kind)) return { ok: false, message: "Ungültiger Typ." };

    let intervall: string | null = String(formData.get("intervall") ?? "");
    if (kind === "LAUFEND") {
      if (!INTERVALL.has(intervall)) intervall = "MONTHLY";
    } else {
      intervall = null;
    }

    const amount = euroZuCents(String(formData.get("betrag") ?? ""));
    if (amount === null) return { ok: false, message: "Bitte einen gültigen Betrag angeben." };

    const kategorie = String(formData.get("kategorie") ?? "").trim().slice(0, 80) || null;
    const notiz = String(formData.get("notiz") ?? "").trim().slice(0, 500) || null;
    const faelligRaw = String(formData.get("faellig_on") ?? "").trim();
    const faellig = /^\d{4}-\d{2}-\d{2}$/.test(faelligRaw) ? faelligRaw : null;

    // Optionaler Beleg-Upload (PDF/Bild) in den privaten documents-Bucket.
    let invoicePath: string | null = null;
    let invoiceName: string | null = null;
    const file = formData.get("beleg");
    if (file && file instanceof File && file.size > 0) {
      const ext = BELEG_MIME[file.type];
      if (!ext) return { ok: false, message: "Beleg muss PDF, JPG, PNG oder WebP sein." };
      if (file.size > DOCUMENT_MAX_BYTES) {
        return { ok: false, message: "Beleg ist zu groß (max. 15 MB)." };
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const objectKey = `fixkosten/${crypto.randomBytes(10).toString("hex")}.${ext}`;
      invoicePath = await uploadDocument(objectKey, bytes, file.type);
      if (!invoicePath) {
        return { ok: false, message: "Beleg konnte nicht hochgeladen werden." };
      }
      invoiceName = file.name.slice(0, 160);
    }

    const [row] = await sql`
      insert into admin.fixed_cost
        (bezeichnung, kind, intervall, amount_cents, kategorie, faellig_on,
         invoice_path, invoice_name, notiz, created_by)
      values (${bezeichnung}, ${kind}, ${intervall}, ${amount}, ${kategorie},
              ${faellig}, ${invoicePath}, ${invoiceName}, ${notiz}, ${employee.id})
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "fixed_cost.created",
      entityType: "fixed_cost",
      entityId: row.id as string,
      metadata: { bezeichnung, kind, intervall, amount },
    });
    revalidatePath("/finanzen/fixkosten");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Fixkosten konnten nicht gespeichert werden." };
  }
}

export async function deleteFixedCost(id: string): Promise<Result> {
  try {
    const employee = await requirePermission("rewards", "delete");
    const [row] = await sql`
      update admin.fixed_cost set deleted_at = now()
      where id = ${id}::uuid and deleted_at is null
      returning invoice_path`;
    if (row?.invoice_path) {
      await deleteDocumentObject(row.invoice_path as string);
    }
    await recordAudit({
      actorId: employee.id,
      action: "fixed_cost.deleted",
      entityType: "fixed_cost",
      entityId: id,
    });
    revalidatePath("/finanzen/fixkosten");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Löschen fehlgeschlagen." };
  }
}

/** Signierte Anzeige-URL für den Beleg einer Fixkosten-Position (5 Min. gültig). */
export async function getFixedCostInvoiceUrl(
  id: string,
): Promise<Result<{ url: string }>> {
  try {
    await requirePermission("rewards", "view");
    const [row] = await sql`
      select invoice_path from admin.fixed_cost
      where id = ${id}::uuid and deleted_at is null`;
    const path = row?.invoice_path as string | null;
    if (!path) return { ok: false, message: "Kein Beleg vorhanden." };
    const url = await createSignedDocumentUrl(path, 300);
    if (!url) return { ok: false, message: "Beleg-Link konnte nicht erzeugt werden." };
    return { ok: true, url };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Beleg konnte nicht geöffnet werden." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export interface MatchSuggestion {
  transactionId: string;
  invoiceId: string;
  nummer: string;
  betrag: number;
  /** "nummer" = Verwendungszweck enthält die Rechnungsnummer, "betrag" = Betrag stimmt exakt. */
  grund: "nummer" | "betrag";
}

type SuggestResult =
  | { ok: true; suggestions: MatchSuggestion[] }
  | { ok: false; message: string };

/** IBAN nur maskiert weitergeben — die vollständige IBAN wird nie geloggt. */
function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, "");
  if (compact.length <= 4) return compact;
  return `•••• ${compact.slice(-4)}`;
}

/**
 * Neues Bankkonto anlegen (Provider MANUELL, Status VORBEREITET). Die echte
 * Bank-Synchronisierung folgt später — hier wird nur die Struktur befüllt.
 */
export async function createBankAccount(input: {
  name: string;
  bankName: string;
  iban: string;
  bic: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "create");

    const name = input.name?.trim();
    const bankName = input.bankName?.trim() ?? "";
    const iban = input.iban?.replace(/\s+/g, "").toUpperCase() ?? "";
    const bic = input.bic?.trim().toUpperCase() ?? "";

    if (!name) {
      return { ok: false, message: "Bitte einen Kontonamen angeben." };
    }
    if (iban.length < 15) {
      return { ok: false, message: "Bitte eine gültige IBAN angeben." };
    }

    const [account] = await sql`
      insert into admin.bank_account (
        name, bank_name, iban, bic, provider, status, balance_cents, created_by
      ) values (
        ${name}, ${bankName || null}, ${iban}, ${bic || null},
        'MANUELL', 'VORBEREITET', 0, ${employee.id}
      )
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "bank.account.created",
      entityType: "bank_account",
      entityId: account.id as string,
      // Nie die vollständige IBAN protokollieren.
      metadata: { name, bankName, ibanMasked: maskIban(iban) },
    });

    revalidatePath("/finanzen/bank");
    return { ok: true, message: `Konto „${name}“ wurde angelegt.` };
  } catch (e) {
    console.error("createBankAccount failed", e);
    return {
      ok: false,
      message: "Das Konto konnte nicht angelegt werden. Bitte erneut versuchen.",
    };
  }
}

/** Bankkonto per Soft-Delete entfernen. */
export async function deleteBankAccount(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "delete");

    const [account] = await sql`
      update admin.bank_account
      set deleted_at = now()
      where id = ${id} and deleted_at is null
      returning id`;
    if (!account) {
      return { ok: false, message: "Das Konto wurde nicht gefunden." };
    }

    await recordAudit({
      actorId: employee.id,
      action: "bank.account.deleted",
      entityType: "bank_account",
      entityId: id,
      metadata: {},
    });

    revalidatePath("/finanzen/bank");
    return { ok: true, message: "Konto entfernt." };
  } catch (e) {
    console.error("deleteBankAccount failed", e);
    return {
      ok: false,
      message: "Das Konto konnte nicht entfernt werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Kontobewegung manuell erfassen (Testdaten, solange CSV-Import/Sync fehlt).
 * Positiver Betrag = Zahlungseingang, negativer Betrag = Ausgang.
 */
export async function createBankTransaction(input: {
  accountId: string;
  bookedAt: string;
  amountCents: number;
  purpose: string;
  counterpartyName: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "create");

    const accountId = input.accountId?.trim();
    const bookedAt = input.bookedAt?.trim();
    const amountCents = Math.trunc(Number(input.amountCents));
    const purpose = input.purpose?.trim() ?? "";
    const counterparty = input.counterpartyName?.trim() ?? "";

    if (!accountId) {
      return { ok: false, message: "Bitte ein Konto auswählen." };
    }
    if (!bookedAt) {
      return { ok: false, message: "Bitte ein Buchungsdatum angeben." };
    }
    if (!Number.isFinite(amountCents) || amountCents === 0) {
      return { ok: false, message: "Bitte einen Betrag ungleich 0 angeben." };
    }

    const [account] = await sql`
      select id from admin.bank_account
      where id = ${accountId} and deleted_at is null
      limit 1`;
    if (!account) {
      return { ok: false, message: "Das gewählte Konto wurde nicht gefunden." };
    }

    const [tx] = await sql`
      insert into admin.bank_transaction (
        account_id, booked_at, amount_cents, currency,
        purpose, counterparty_name, status, imported_at
      ) values (
        ${accountId}, ${bookedAt}, ${amountCents}, 'EUR',
        ${purpose || null}, ${counterparty || null}, 'UNMATCHED', now()
      )
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "bank.transaction.created",
      entityType: "bank_transaction",
      entityId: tx.id as string,
      metadata: { accountId, amountCents, purpose },
    });

    revalidatePath("/finanzen/bank");
    return { ok: true, message: "Buchung erfasst." };
  } catch (e) {
    console.error("createBankTransaction failed", e);
    return {
      ok: false,
      message: "Die Buchung konnte nicht erfasst werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Abgleich-Vorschläge: nicht zugeordnete Zahlungseingänge (amount_cents > 0)
 * gegen offene/überfällige Rechnungen. Match, wenn der Betrag exakt der
 * Rechnungssumme entspricht ODER der Verwendungszweck die Rechnungsnummer
 * enthält. Pro Zahlungseingang wird der beste Treffer vorgeschlagen
 * (Nummer-Treffer schlägt reinen Betrags-Treffer).
 */
export async function abgleichVorschlaege(): Promise<SuggestResult> {
  try {
    await requirePermission("rewards", "view");

    const rows = await sql`
      select distinct on (t.id)
        t.id           as transaction_id,
        t.amount_cents as amount_cents,
        i.id           as invoice_id,
        i.nummer       as nummer,
        case when t.purpose is not null and t.purpose ilike '%' || i.nummer || '%'
             then 'nummer' else 'betrag' end as grund
      from admin.bank_transaction t
      join admin.invoice i
        on i.deleted_at is null
       and i.status in ('OFFEN', 'UEBERFAELLIG')
       and (
             i.total_cents = t.amount_cents
             or (t.purpose is not null and t.purpose ilike '%' || i.nummer || '%')
           )
      where t.status = 'UNMATCHED'
        and t.amount_cents > 0
      order by t.id,
        -- Nummer-Treffer bevorzugen, dann exakter Betrag
        (case when t.purpose is not null and t.purpose ilike '%' || i.nummer || '%'
              then 0 else 1 end),
        (case when i.total_cents = t.amount_cents then 0 else 1 end)`;

    const suggestions: MatchSuggestion[] = rows.map((r) => ({
      transactionId: r.transaction_id as string,
      invoiceId: r.invoice_id as string,
      nummer: r.nummer as string,
      betrag: Number(r.amount_cents ?? 0),
      grund: (r.grund as "nummer" | "betrag") ?? "betrag",
    }));

    return { ok: true, suggestions };
  } catch (e) {
    console.error("abgleichVorschlaege failed", e);
    return {
      ok: false,
      message: "Die Vorschläge konnten nicht geladen werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Zuordnung bestätigen: Zahlungseingang mit Rechnung verknüpfen
 * (bank_transaction → MATCHED) und die Rechnung als BEZAHLT markieren.
 * Nur möglich, solange die Rechnung offen oder überfällig ist.
 */
export async function zuordnenBestaetigen(
  transactionId: string,
  invoiceId: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "edit");

    if (!transactionId || !invoiceId) {
      return { ok: false, message: "Zuordnung unvollständig." };
    }

    const [tx] = await sql`
      select id, status, amount_cents from admin.bank_transaction
      where id = ${transactionId}
      limit 1`;
    if (!tx) {
      return { ok: false, message: "Der Zahlungseingang wurde nicht gefunden." };
    }
    if (tx.status === "MATCHED") {
      return { ok: false, message: "Dieser Zahlungseingang ist bereits zugeordnet." };
    }

    // Rechnung nur zuordnen, wenn sie noch offen/überfällig ist.
    const [invoice] = await sql`
      update admin.invoice
      set status = 'BEZAHLT', paid_at = now(), updated_at = now()
      where id = ${invoiceId}
        and deleted_at is null
        and status in ('OFFEN', 'UEBERFAELLIG')
      returning id, nummer, placement_id`;
    if (!invoice) {
      return {
        ok: false,
        message: "Die Rechnung ist nicht (mehr) offen und kann nicht zugeordnet werden.",
      };
    }

    await sql`
      update admin.bank_transaction
      set matched_invoice_id = ${invoiceId}, status = 'MATCHED'
      where id = ${transactionId}`;

    // Zugehörige Vermittlung konsistent auf PAID setzen (wie beim manuellen
    // „bezahlt“-Markieren in der Finanz-Übersicht).
    if (invoice.placement_id) {
      await sql`
        update admin.placement
        set status = 'PAID', updated_at = now()
        where id = ${invoice.placement_id} and status <> 'CANCELLED'`;
    }

    await recordAudit({
      actorId: employee.id,
      action: "bank.matched",
      entityType: "bank_transaction",
      entityId: transactionId,
      metadata: {
        invoiceId,
        nummer: invoice.nummer,
        amountCents: Number(tx.amount_cents ?? 0),
      },
    });

    revalidatePath("/finanzen/bank");
    revalidatePath("/finanzen");
    revalidatePath(`/finanzen/${invoiceId}`);
    return {
      ok: true,
      message: `Rechnung ${invoice.nummer as string} zugeordnet und als bezahlt markiert.`,
    };
  } catch (e) {
    console.error("zuordnenBestaetigen failed", e);
    return {
      ok: false,
      message: "Die Zuordnung ist fehlgeschlagen. Bitte erneut versuchen.",
    };
  }
}

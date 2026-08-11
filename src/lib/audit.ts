import "server-only";
import { sql } from "./db";

/**
 * Append-only admin audit trail. Call from server actions after any
 * relevant mutation — never from the client.
 */
export async function recordAudit(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { actorId, action, entityType, entityId = null, metadata = {} } = params;
  try {
    await sql`
      insert into admin.audit_log (actor_id, action, entity_type, entity_id, metadata)
      values (${actorId}, ${action}, ${entityType}, ${entityId}, ${sql.json(metadata as never)})`;
  } catch (err) {
    // Auditing must never break the mutation itself; log server-side only.
    console.error("audit_log write failed", err);
  }
}

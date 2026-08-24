import { NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { effektivePraesenz } from "@/lib/presence";

/**
 * Chat-Backend (Polling): liefert die Konversationsliste (alle aktiven Kollegen
 * mit letzter Nachricht + Ungelesen-Zähler) und – bei `?with=<id>` – den
 * kompletten Thread; das Öffnen markiert die eingehenden Nachrichten als gelesen.
 */
export async function GET(request: Request) {
  const me = await getEmployee();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const withId = new URL(request.url).searchParams.get("with");

  const convos = await sql`
    with others as (
      select id, name, avatar_color, avatar_url, presence, last_seen_at
      from admin.employee
      where status = 'ACTIVE' and deleted_at is null and id <> ${me.id}
    )
    select o.id, o.name, o.avatar_color, o.avatar_url, o.presence, o.last_seen_at,
           lm.body as last_body, lm.created_at as last_at, lm.sender_id as last_sender,
           coalesce(u.cnt, 0) as unread
    from others o
    left join lateral (
      select body, created_at, sender_id
      from admin.chat_message m
      where m.deleted_at is null
        and ((m.sender_id = ${me.id} and m.recipient_id = o.id)
          or (m.sender_id = o.id and m.recipient_id = ${me.id}))
      order by m.created_at desc limit 1
    ) lm on true
    left join lateral (
      select count(*)::int as cnt from admin.chat_message m
      where m.recipient_id = ${me.id} and m.sender_id = o.id
        and m.read_at is null and m.deleted_at is null
    ) u on true
    order by (lm.created_at is null), lm.created_at desc nulls last, o.name`;

  const conversations = convos.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    avatarColor: c.avatar_color as string,
    avatarUrl: (c.avatar_url as string | null) ?? null,
    presence: effektivePraesenz(
      (c.presence as string) ?? "AVAILABLE",
      c.last_seen_at as Date | null,
    ),
    lastBody: (c.last_body as string | null) ?? null,
    lastAt: (c.last_at as Date | null) ?? null,
    lastFromMe: c.last_sender === me.id,
    unread: c.unread as number,
  }));

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  let messages: unknown[] | undefined;
  let partner: { id: string; name: string; avatarColor: string; avatarUrl: string | null; presence: string } | undefined;
  if (withId) {
    const found = conversations.find((c) => c.id === withId);
    if (found) {
      partner = {
        id: found.id,
        name: found.name,
        avatarColor: found.avatarColor,
        avatarUrl: found.avatarUrl,
        presence: found.presence,
      };
      const rows = await sql`
        select id, sender_id, body, tags, created_at, read_at
        from admin.chat_message
        where deleted_at is null
          and ((sender_id = ${me.id} and recipient_id = ${withId}::uuid)
            or (sender_id = ${withId}::uuid and recipient_id = ${me.id}))
        order by created_at asc limit 300`;
      messages = rows.map((m) => ({
        id: m.id as string,
        body: m.body as string,
        fromMe: m.sender_id === me.id,
        createdAt: m.created_at as Date,
        readAt: (m.read_at as Date | null) ?? null,
        tags: (m.tags as { entityType: string; entityId: string; label?: string }[]) ?? [],
      }));
      // Eingehende Nachrichten dieses Threads als gelesen markieren.
      await sql`
        update admin.chat_message set read_at = now()
        where recipient_id = ${me.id} and sender_id = ${withId}::uuid
          and read_at is null and deleted_at is null`;
    }
  }

  return NextResponse.json({ conversations, totalUnread, messages, partner });
}

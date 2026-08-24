"use client";

import * as React from "react";
import Link from "next/link";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  Tag,
  X,
  Search,
  Loader2,
  Building2,
  UserSquare2,
  Check,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { PRAESENZ_META, type EffektivePraesenz } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { sendeChatNachricht, type ChatTag } from "./chat-actions";
import { sucheTaggbareEntitaeten } from "@/app/(app)/benachrichtigungen/actions";

interface Conversation {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  presence: EffektivePraesenz;
  lastBody: string | null;
  lastAt: string | null;
  lastFromMe: boolean;
  unread: number;
}

interface Message {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: string;
  readAt: string | null;
  tags: ChatTag[];
}

interface Partner {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  presence: EffektivePraesenz;
}

function tagHref(t: ChatTag): string {
  return t.entityType === "candidate"
    ? `/kandidaten/${t.entityId}`
    : `/unternehmen/${t.entityId}`;
}

/** „Heute" / „Gestern" / voller Wochentag als Datums-Trenner. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Gestern";
  if (diff > 1 && diff < 7)
    return d.toLocaleDateString("de-DE", { weekday: "long" });
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Kompakte, „vor X" Relativzeit für die Konversationsliste. */
function shortRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "jetzt";
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function PresenceDot({
  presence,
  className,
}: {
  presence: EffektivePraesenz;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block size-2.5 rounded-full ring-2 ring-card",
        PRAESENZ_META[presence].dot,
        presence === "ONLINE" && "chat-dot-live",
        className,
      )}
      aria-hidden
    />
  );
}

export function ChatButton({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = React.useState(false);
  const [conversations, setConversations] = React.useState<Conversation[] | null>(null);
  const [totalUnread, setTotalUnread] = React.useState(initialUnread);
  const [filter, setFilter] = React.useState("");

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [partner, setPartner] = React.useState<Partner | null>(null);
  const [messages, setMessages] = React.useState<Message[] | null>(null);

  const [draft, setDraft] = React.useState("");
  const [draftTags, setDraftTags] = React.useState<ChatTag[]>([]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const seenIds = React.useRef<Set<string>>(new Set());

  const applyList = React.useCallback(
    (d: { conversations?: Conversation[]; totalUnread?: number }) => {
      if (d.conversations) setConversations(d.conversations);
      if (typeof d.totalUnread === "number") setTotalUnread(d.totalUnread);
    },
    [],
  );

  // Konversationsliste + Badge — immer aktiv, häufiger wenn geöffnet.
  React.useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/chat")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && applyList(d))
        .catch(() => {});
    load();
    const iv = setInterval(load, open ? 8000 : 25000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [open, applyList]);

  // Aktiver Thread — Nachrichten laden & als gelesen markieren, dann pollen.
  React.useEffect(() => {
    if (!activeId || !open) return;
    let alive = true;
    const load = () =>
      fetch(`/api/chat?with=${activeId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return;
          if (d.messages) setMessages(d.messages);
          if (d.partner) setPartner(d.partner);
          applyList(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [activeId, open, applyList]);

  // Nach unten scrollen, wenn neue Nachrichten kommen.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const openThread = (c: Conversation) => {
    seenIds.current = new Set();
    setActiveId(c.id);
    setPartner({
      id: c.id,
      name: c.name,
      avatarColor: c.avatarColor,
      avatarUrl: c.avatarUrl,
      presence: c.presence,
    });
    setMessages(null);
    setDraft("");
    setDraftTags([]);
    setError(null);
  };

  const backToList = () => {
    setActiveId(null);
    setPartner(null);
    setMessages(null);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setError(null);
    const res = await sendeChatNachricht({
      recipientId: activeId,
      body,
      tags: draftTags,
    });
    setSending(false);
    if (res.ok) {
      setDraft("");
      setDraftTags([]);
      const d = await fetch(`/api/chat?with=${activeId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (d) {
        if (d.messages) setMessages(d.messages);
        applyList(d);
      }
    } else {
      setError(res.message);
    }
  };

  const filtered = (conversations ?? []).filter((c) =>
    c.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) backToList();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-8.5 bg-card"
          aria-label="Chat"
        >
          <MessageSquare className="size-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-sm ring-2 ring-card">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex h-[33rem] w-[24.5rem] flex-col overflow-hidden p-0 shadow-xl"
      >
        {!activeId ? (
          <ConversationList
            conversations={conversations}
            filtered={filtered}
            filter={filter}
            setFilter={setFilter}
            totalUnread={totalUnread}
            onOpen={openThread}
          />
        ) : (
          <>
            <ThreadHeader partner={partner} onBack={backToList} />
            <div
              ref={scrollRef}
              className="chat-scroll min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/40 to-background px-3.5 py-3"
            >
              <MessageList
                messages={messages}
                partner={partner}
                seenIds={seenIds}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <Composer
              draft={draft}
              setDraft={setDraft}
              draftTags={draftTags}
              setDraftTags={setDraftTags}
              sending={sending}
              onSend={send}
              error={error}
            />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------------------------------------------- Liste --- */

function ConversationList({
  conversations,
  filtered,
  filter,
  setFilter,
  totalUnread,
  onOpen,
}: {
  conversations: Conversation[] | null;
  filtered: Conversation[];
  filter: string;
  setFilter: (v: string) => void;
  totalUnread: number;
  onOpen: (c: Conversation) => void;
}) {
  return (
    <>
      <div className="relative shrink-0 overflow-hidden border-b bg-gradient-to-r from-primary/12 via-card to-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <MessageSquare className="size-4" />
            </span>
            <p className="text-sm font-semibold">Team-Chat</p>
          </div>
          {totalUnread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {totalUnread} neu
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Kollegen suchen…"
            className="h-9 w-full rounded-lg border bg-background pl-8 pr-2 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>
      </div>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto py-1">
        {conversations === null ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <p className="text-sm">Lädt…</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Keine Kollegen gefunden.
          </p>
        ) : (
          filtered.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onOpen(c)}
              style={{ animationDelay: `${Math.min(i, 8) * 22}ms` }}
              className={cn(
                "chat-row-in mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                c.unread > 0 ? "bg-primary/8 hover:bg-primary/12" : "hover:bg-muted/70",
              )}
            >
              <span className="relative shrink-0">
                <EmployeeAvatar name={c.name} color={c.avatarColor} imageUrl={c.avatarUrl} />
                <span className="absolute -right-0.5 -bottom-0.5">
                  <PresenceDot presence={c.presence} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-sm",
                      c.unread > 0 ? "font-semibold" : "font-medium",
                    )}
                  >
                    {c.name}
                  </span>
                  {c.lastAt && (
                    <span
                      className={cn(
                        "shrink-0 text-[10px]",
                        c.unread > 0
                          ? "font-semibold text-primary"
                          : "text-muted-foreground/70",
                      )}
                    >
                      {shortRelative(c.lastAt)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      c.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {c.lastBody ? (
                      <>
                        {c.lastFromMe && <span className="text-muted-foreground">Du: </span>}
                        {c.lastBody}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                        <Sparkles className="size-3" /> Unterhaltung beginnen
                      </span>
                    )}
                  </span>
                  {c.unread > 0 && (
                    <span className="flex min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- Thread --- */

function ThreadHeader({
  partner,
  onBack,
}: {
  partner: Partner | null;
  onBack: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-gradient-to-r from-primary/10 via-card to-card px-2.5 py-2.5">
      <button
        onClick={onBack}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Zurück"
      >
        <ArrowLeft className="size-4" />
      </button>
      {partner && (
        <span className="relative shrink-0">
          <EmployeeAvatar
            name={partner.name}
            color={partner.avatarColor}
            imageUrl={partner.avatarUrl}
          />
          <span className="absolute -right-0.5 -bottom-0.5">
            <PresenceDot presence={partner.presence} />
          </span>
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{partner?.name}</p>
        {partner && (
          <p className={cn("flex items-center gap-1 text-[11px]", PRAESENZ_META[partner.presence].text)}>
            {PRAESENZ_META[partner.presence].label}
          </p>
        )}
      </div>
    </div>
  );
}

function MessageList({
  messages,
  partner,
  seenIds,
  onNavigate,
}: {
  messages: Message[] | null;
  partner: Partner | null;
  seenIds: React.MutableRefObject<Set<string>>;
  onNavigate: () => void;
}) {
  if (messages === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="chat-typing flex items-center gap-1">
          <span className="size-2 rounded-full bg-current" />
          <span className="size-2 rounded-full bg-current" />
          <span className="size-2 rounded-full bg-current" />
        </span>
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageSquare className="size-6" />
        </span>
        <p className="text-sm font-medium">Noch keine Nachrichten</p>
        <p className="text-xs text-muted-foreground">
          Schreib {partner?.name?.split(" ")[0] ?? "deinem Kollegen"} die erste Nachricht.
        </p>
      </div>
    );
  }

  const GAP = 5 * 60 * 1000; // Gruppen-Grenze bei > 5 Min. Abstand.
  const lastMineIdx = messages.reduce((acc, m, i) => (m.fromMe ? i : acc), -1);

  return (
    <div className="flex flex-col gap-0.5">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const t = new Date(m.createdAt).getTime();
        const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
        const firstOfGroup =
          !prev ||
          prev.fromMe !== m.fromMe ||
          newDay ||
          t - new Date(prev.createdAt).getTime() > GAP;
        const lastOfGroup =
          !next ||
          next.fromMe !== m.fromMe ||
          dayLabel(next.createdAt) !== dayLabel(m.createdAt) ||
          new Date(next.createdAt).getTime() - t > GAP;

        // Nur wirklich neu eingetroffene Nachrichten animieren (kein Flackern beim Poll).
        const isNew = !seenIds.current.has(m.id);
        seenIds.current.add(m.id);

        return (
          <React.Fragment key={m.id}>
            {newDay && (
              <div className="my-2 flex items-center justify-center">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {dayLabel(m.createdAt)}
                </span>
              </div>
            )}
            <div
              className={cn(
                "flex items-end gap-1.5",
                m.fromMe ? "flex-row-reverse" : "flex-row",
                firstOfGroup ? "mt-2" : "mt-0.5",
              )}
            >
              {/* Avatar-Slot für den Gesprächspartner (nur am Gruppenende). */}
              {!m.fromMe &&
                partner &&
                (lastOfGroup ? (
                  <EmployeeAvatar
                    name={partner.name}
                    color={partner.avatarColor}
                    imageUrl={partner.avatarUrl}
                    size="sm"
                  />
                ) : (
                  <span className="w-6 shrink-0" aria-hidden />
                ))}

              <div className={cn("flex max-w-[78%] flex-col", m.fromMe ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    isNew && "chat-msg-in",
                    "px-3 py-2 text-sm shadow-sm",
                    m.fromMe
                      ? "bg-primary text-primary-foreground shadow-primary/20"
                      : "border bg-card text-foreground",
                    // iMessage-artige Radien: an der Gruppen-Ecke „angebissen".
                    m.fromMe
                      ? cn("rounded-2xl", lastOfGroup && "rounded-br-md")
                      : cn("rounded-2xl", lastOfGroup && "rounded-bl-md"),
                  )}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                </div>

                {m.tags && m.tags.length > 0 && (
                  <div
                    className={cn(
                      "mt-1 flex flex-wrap gap-1",
                      m.fromMe ? "justify-end" : "justify-start",
                    )}
                  >
                    {m.tags.map((tg) => (
                      <Link
                        key={`${tg.entityType}-${tg.entityId}`}
                        href={tagHref(tg)}
                        onClick={onNavigate}
                        className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {tg.entityType === "candidate" ? (
                          <UserSquare2 className="size-3" />
                        ) : (
                          <Building2 className="size-3" />
                        )}
                        {tg.label ??
                          (tg.entityType === "candidate" ? "Kandidat" : "Unternehmen")}
                      </Link>
                    ))}
                  </div>
                )}

                {lastOfGroup && (
                  <span
                    className={cn(
                      "mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground/70",
                      m.fromMe ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    {clock(m.createdAt)}
                    {m.fromMe &&
                      i === lastMineIdx &&
                      (m.readAt ? (
                        <span className="flex items-center gap-0.5 text-primary">
                          <CheckCheck className="size-3" /> Gelesen
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Check className="size-3" /> Gesendet
                        </span>
                      ))}
                  </span>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Composer --- */

/** Eingabe-Zeile mit Entity-Tagging (Nutzer/Unternehmen erwähnen). */
function Composer({
  draft,
  setDraft,
  draftTags,
  setDraftTags,
  sending,
  onSend,
  error,
}: {
  draft: string;
  setDraft: (v: string) => void;
  draftTags: ChatTag[];
  setDraftTags: React.Dispatch<React.SetStateAction<ChatTag[]>>;
  sending: boolean;
  onSend: () => void;
  error: string | null;
}) {
  const [showTag, setShowTag] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<{
    kandidaten: { id: string; label: string }[];
    unternehmen: { id: string; label: string; hint: string | null }[];
  }>({ kandidaten: [], unternehmen: [] });
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (!showTag) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults({ kandidaten: [], unternehmen: [] });
      return;
    }
    let alive = true;
    setSearching(true);
    const id = setTimeout(() => {
      sucheTaggbareEntitaeten(term)
        .then((r) => alive && setResults(r))
        .catch(() => {})
        .finally(() => alive && setSearching(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, showTag]);

  const addTag = (t: ChatTag) => {
    setDraftTags((prev) =>
      prev.some((x) => x.entityType === t.entityType && x.entityId === t.entityId)
        ? prev
        : [...prev, t],
    );
    setQ("");
    setResults({ kandidaten: [], unternehmen: [] });
  };
  const removeTag = (t: ChatTag) =>
    setDraftTags((prev) =>
      prev.filter((x) => !(x.entityType === t.entityType && x.entityId === t.entityId)),
    );

  return (
    <div className="shrink-0 border-t bg-card">
      {showTag && (
        <div className="border-b bg-muted/40 px-3 py-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nutzer oder Unternehmen erwähnen…"
              className="h-8 w-full rounded-lg border bg-background pl-8 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
          {(searching || results.kandidaten.length > 0 || results.unternehmen.length > 0) && (
            <div className="chat-scroll mt-1.5 max-h-36 overflow-y-auto rounded-lg border bg-card">
              {searching && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Suche…</p>
              )}
              {results.kandidaten.map((k) => (
                <button
                  key={`c-${k.id}`}
                  onClick={() =>
                    addTag({ entityType: "candidate", entityId: k.id, label: k.label })
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <UserSquare2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{k.label}</span>
                </button>
              ))}
              {results.unternehmen.map((u) => (
                <button
                  key={`u-${u.id}`}
                  onClick={() =>
                    addTag({ entityType: "company", entityId: u.id, label: u.label })
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{u.label}</span>
                  {u.hint && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {u.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {draftTags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {draftTags.map((t) => (
            <span
              key={`${t.entityType}-${t.entityId}`}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
            >
              {t.entityType === "candidate" ? (
                <UserSquare2 className="size-3" />
              ) : (
                <Building2 className="size-3" />
              )}
              {t.label}
              <button onClick={() => removeTag(t)} aria-label="Entfernen">
                <X className="size-3 hover:text-destructive" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="px-3 pt-1.5 text-xs text-destructive">{error}</p>}

      <div className="flex items-end gap-1.5 p-2.5">
        <div className="flex flex-1 items-end gap-1 rounded-2xl border bg-background px-1 py-1 transition-shadow focus-within:ring-2 focus-within:ring-primary/40">
          <button
            onClick={() => setShowTag((v) => !v)}
            className={cn(
              "shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              showTag && "bg-primary/15 text-primary",
            )}
            aria-label="Nutzer/Unternehmen erwähnen"
            title="Nutzer oder Unternehmen erwähnen"
          >
            <Tag className="size-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="Nachricht schreiben…"
            className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none"
          />
        </div>
        <Button
          size="icon"
          className="size-10 shrink-0 rounded-full shadow-sm transition-transform active:scale-95"
          onClick={onSend}
          disabled={sending || !draft.trim()}
          aria-label="Senden"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

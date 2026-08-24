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
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { PRAESENZ_META, type EffektivePraesenz } from "@/lib/presence";
import { formatRelative } from "@/lib/format";
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

function PresenceDot({ presence }: { presence: EffektivePraesenz }) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full ring-2 ring-card",
        PRAESENZ_META[presence].dot,
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
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex h-[30rem] w-96 flex-col p-0">
        {!activeId ? (
          <>
            {/* Konversationsliste */}
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-sm font-semibold">Chat</p>
              {totalUnread > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {totalUnread} ungelesen
                </span>
              )}
            </div>
            <div className="border-b px-3 py-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Kollegen suchen…"
                  className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations === null ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Lädt…
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Keine Kollegen gefunden.
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openThread(c)}
                    className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-0 hover:bg-muted/60"
                  >
                    <span className="relative shrink-0">
                      <EmployeeAvatar
                        name={c.name}
                        color={c.avatarColor}
                        imageUrl={c.avatarUrl}
                      />
                      <span className="absolute -right-0.5 -bottom-0.5">
                        <PresenceDot presence={c.presence} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        {c.lastAt && (
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">
                            {formatRelative(c.lastAt)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-xs",
                            c.unread > 0
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.lastBody
                            ? `${c.lastFromMe ? "Du: " : ""}${c.lastBody}`
                            : "Neue Unterhaltung beginnen"}
                        </span>
                        {c.unread > 0 && (
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
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
        ) : (
          <>
            {/* Thread-Ansicht */}
            <div className="flex items-center gap-2 border-b px-2.5 py-2">
              <button
                onClick={backToList}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                    size="sm"
                  />
                  <span className="absolute -right-0.5 -bottom-0.5">
                    <PresenceDot presence={partner.presence} />
                  </span>
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{partner?.name}</p>
                {partner && (
                  <p className={cn("text-[11px]", PRAESENZ_META[partner.presence].text)}>
                    {PRAESENZ_META[partner.presence].label}
                  </p>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
              {messages === null ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Lädt…</p>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Noch keine Nachrichten — schreib die erste.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex flex-col", m.fromMe ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        m.fromMe
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                    {m.tags && m.tags.length > 0 && (
                      <div className="mt-1 flex max-w-[80%] flex-wrap gap-1">
                        {m.tags.map((t) => (
                          <Link
                            key={`${t.entityType}-${t.entityId}`}
                            href={tagHref(t)}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {t.entityType === "candidate" ? (
                              <UserSquare2 className="size-3" />
                            ) : (
                              <Building2 className="size-3" />
                            )}
                            {t.label ?? (t.entityType === "candidate" ? "Kandidat" : "Unternehmen")}
                          </Link>
                        ))}
                      </div>
                    )}
                    <span className="mt-0.5 px-1 text-[10px] text-muted-foreground/60">
                      {formatRelative(m.createdAt)}
                    </span>
                  </div>
                ))
              )}
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
    <div className="border-t">
      {showTag && (
        <div className="border-b bg-muted/40 px-3 py-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nutzer oder Unternehmen erwähnen…"
              className="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {(searching || results.kandidaten.length > 0 || results.unternehmen.length > 0) && (
            <div className="mt-1.5 max-h-36 overflow-y-auto rounded-md border bg-card">
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

      <div className="flex items-end gap-1.5 p-2">
        <button
          onClick={() => setShowTag((v) => !v)}
          className={cn(
            "shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground",
            showTag && "bg-accent text-accent-foreground",
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
          className="max-h-24 min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="icon"
          className="size-9 shrink-0"
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

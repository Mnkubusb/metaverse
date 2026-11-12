"use client"
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Lock, MessageCircle, SendHorizontal, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocket, ChatMessage, DirectMessage } from '../../contexts/WebSocketsContexts';
import { dmAPI, DmMessage, DmThread } from '@/lib/api';
import { AvatarSprite } from '../avatar/AvatarPicker';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 500;
const NAME_COLORS = ['text-sky-300', 'text-amber-300', 'text-emerald-300', 'text-pink-300', 'text-violet-300', 'text-orange-300', 'text-lime-300', 'text-cyan-300'];
const DEFAULT_AVATAR = '/Characters/WalkAnimations.png';

function nameColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export interface Person { userId: string; username: string; avatar?: string | null }

function Head({ url, className }: { url?: string | null; className?: string }) {
  return (
    <span aria-hidden className={cn('relative size-8 shrink-0 overflow-hidden rounded-md bg-[#84c669]', className)}>
      <AvatarSprite url={url || DEFAULT_AVATAR} className="absolute -left-6 -top-3" />
    </span>
  );
}

function Composer({ id, placeholder, onSend, inputRef }: {
  id: string;
  placeholder: string;
  onSend: (text: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [draft, setDraft] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        onSend(draft);
        setDraft('');
      }}
      className="flex items-center gap-2 border-t border-white/10 p-2"
    >
      <label htmlFor={id} className="sr-only">Message</label>
      <input
        id={id}
        ref={inputRef}
        value={draft}
        maxLength={MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/15 focus:ring-2 focus:ring-emerald-300/50"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        aria-label="Send message"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-[#06281c] transition hover:bg-emerald-300 disabled:bg-white/10 disabled:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
      >
        <SendHorizontal className="size-4" />
      </button>
    </form>
  );
}

// `compact` (phones): opened from the chat button in the space's toolbar (pass `open`/`onOpenChange`),
// it covers the bottom of the screen and renders nothing while closed.
// `dmWith` opens a private conversation (set when a player is clicked on the map).
export default function ChatPanel({ compact = false, open: openProp, onOpenChange, people = [], dmWith, onDmWithChange }: {
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  people?: Person[];
  dmWith?: Person | null;
  onDmWithChange?: (p: Person | null) => void;
}) {
  const { chat, chatError, sendChat, selfId, sendDm, subscribeDm, dmError } = useWebSocket();
  const [openState, setOpenState] = useState(true);
  const open = openProp ?? openState;
  const setOpen = useCallback((next: boolean) => {
    if (onOpenChange) onOpenChange(next); else setOpenState(next);
  }, [onOpenChange]);
  const [tab, setTab] = useState<'space' | 'direct'>('space');
  const [seen, setSeen] = useState(chat.length);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  // --- direct messages -----------------------------------------------------------------------
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [convo, setConvo] = useState<{ person: Person; messages: DmMessage[]; hasMore: boolean; loading: boolean } | null>(null);
  const convoRef = useRef(convo);
  convoRef.current = convo;
  const viewing = open && tab === 'direct' && convo ? convo.person.userId : null;
  const viewingRef = useRef(viewing);
  viewingRef.current = viewing;
  const dmListRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    dmAPI.threads().then((r) => setThreads(r.data.threads)).catch(() => undefined);
  }, []);

  const openConversation = useCallback((person: Person) => {
    setTab('direct');
    setOpen(true);
    setConvo({ person, messages: [], hasMore: false, loading: true });
    setThreads((prev) => prev.map((t) => (t.userId === person.userId ? { ...t, unread: 0 } : t)));
    dmAPI.history(person.userId)
      .then((r) => setConvo((c) => (c && c.person.userId === person.userId
        ? { person: { ...person, avatar: person.avatar ?? r.data.user.avatar }, messages: r.data.messages, hasMore: r.data.hasMore, loading: false } : c)))
      .catch(() => setConvo((c) => (c ? { ...c, loading: false } : c)));
  }, [setOpen]);

  useEffect(() => {
    if (!dmWith) return;
    openConversation(dmWith);
    onDmWithChange?.(null);
  }, [dmWith, openConversation, onDmWithChange]);

  useEffect(() => subscribeDm((m: DirectMessage) => {
    const other = m.from === selfId ? m.to : m.from;
    const otherName = m.from === selfId ? m.toName : m.fromName;
    const msg: DmMessage = { id: m.id, from: m.from, to: m.to, text: m.text, createdAt: m.createdAt };
    const isOpen = viewingRef.current === other;
    if (convoRef.current?.person.userId === other) {
      setConvo((c) => (c && !c.messages.some((x) => x.id === m.id) ? { ...c, messages: [...c.messages, msg] } : c));
    }
    if (isOpen && m.from !== selfId) dmAPI.markRead(other).catch(() => undefined);
    setThreads((prev) => {
      const existing = prev.find((t) => t.userId === other);
      const unread = (existing?.unread ?? 0) + (m.from !== selfId && !isOpen ? 1 : 0);
      const avatar = existing?.avatar ?? people.find((p) => p.userId === other)?.avatar ?? null;
      const updated: DmThread = { userId: other, username: otherName, avatar, last: m.text, lastAt: m.createdAt, fromMe: m.from === selfId, unread };
      return [updated, ...prev.filter((t) => t.userId !== other)];
    });
    if (m.from !== selfId && !isOpen) {
      toast(`${m.fromName}`, {
        description: m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text,
        action: { label: 'Reply', onClick: () => openConversation({ userId: m.from, username: m.fromName }) },
      });
    }
  }), [subscribeDm, selfId, people, openConversation]);

  useEffect(() => {
    const list = dmListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [convo?.messages.length]);

  const loadOlder = () => {
    const c = convoRef.current;
    if (!c || !c.messages.length) return;
    dmAPI.history(c.person.userId, c.messages[0]!.createdAt).then((r) => setConvo((cur) => (cur && cur.person.userId === c.person.userId
      ? { ...cur, messages: [...r.data.messages, ...cur.messages], hasMore: r.data.hasMore } : cur))).catch(() => undefined);
  };

  const dmUnread = threads.reduce((n, t) => n + t.unread, 0);

  // --- space chat ------------------------------------------------------------------------------
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  // Enter (while not typing elsewhere) jumps into the chat box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpenRef.current(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
    if (open && tab === 'space') setSeen(chat.length);
  }, [chat, open, tab]);

  const unread = open && tab === 'space' ? 0 : chat.slice(seen).filter((m) => !m.system && m.userId !== selfId).length;

  if (compact && !open) return null;

  // people to message: everyone in this space, then past conversations
  const here = new Set(people.map((p) => p.userId));
  const directory: (Person & { thread?: DmThread; here: boolean })[] = [
    ...people.map((p) => ({ ...p, here: true, thread: threads.find((t) => t.userId === p.userId) })),
    ...threads.filter((t) => !here.has(t.userId)).map((t) => ({ userId: t.userId, username: t.username, avatar: t.avatar, here: false, thread: t })),
  ].sort((a, b) => (b.thread?.unread ?? 0) - (a.thread?.unread ?? 0) || (b.thread?.lastAt ?? '').localeCompare(a.thread?.lastAt ?? ''));

  const tabBtn = (id: 'space' | 'direct', label: string, icon: React.ReactNode, badge: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => { setTab(id); if (!open) setOpen(true); }}
      className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60',
        tab === id && open ? 'bg-white/12 text-white' : 'text-white/60 hover:text-white')}
    >
      {icon}{label}
      {badge > 0 && <span className="rounded-full bg-emerald-400 px-1.5 text-[11px] font-bold leading-4 tabular-nums text-[#06281c]">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );

  return (
    <section
      aria-label="Chat"
      className={cn(
        'pointer-events-auto absolute z-40 flex flex-col overflow-hidden rounded-xl hud text-white',
        compact ? 'inset-x-3 bottom-3 max-h-[70dvh] bg-[#0e1813]/95' : 'bottom-4 left-4 w-[min(360px,calc(100%-2rem))]',
      )}
    >
      <div className="flex items-center gap-1 px-2 py-1.5" role="tablist" aria-label="Chat channels">
        {tabBtn('space', 'Space', <MessageCircle className="size-4" />, unread)}
        {tabBtn('direct', 'Direct', <Lock className="size-3.5" />, dmUnread)}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Collapse chat' : 'Expand chat'}
          className="ml-auto flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
          <ChevronDown className={cn('size-4 transition-transform', !open && 'rotate-180')} />
        </button>
      </div>

      {open && tab === 'space' && (
        <>
          <ol
            ref={listRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
            aria-live="polite"
            className="flex max-h-64 min-h-24 flex-col gap-1.5 overflow-y-auto border-t border-white/10 px-4 py-3 text-sm"
          >
            {chat.length === 0 && (
              <li className="my-auto text-center text-white/50">No messages yet. Say hi.</li>
            )}
            {chat.map((m: ChatMessage) => m.system ? (
              <li key={m.id} className="text-center text-xs text-white/45">{m.text}</li>
            ) : (
              <li key={m.id} className="break-words leading-snug">
                <span className="mr-1.5 text-[11px] tabular-nums text-white/40">{time(m.createdAt)}</span>
                {m.userId && m.userId !== selfId ? (
                  <button type="button" onClick={() => openConversation({ userId: m.userId!, username: m.username })}
                    title={`Message ${m.username} privately`}
                    className={cn('font-semibold underline-offset-2 hover:underline', nameColor(m.username))}>
                    {m.username}
                  </button>
                ) : (
                  <span className={cn('font-semibold', m.userId === selfId ? 'text-emerald-300' : nameColor(m.username))}>
                    {m.userId === selfId ? 'You' : m.username}
                  </span>
                )}
                <span className="text-white/90">: {m.text}</span>
              </li>
            ))}
          </ol>
          <Composer id="chat-input" inputRef={inputRef} placeholder={compact ? 'Message everyone' : 'Press Enter to chat · Esc to move'}
            onSend={(t) => { sendChat(t); stickToBottom.current = true; }} />
          {chatError && <p role="status" className="px-4 pb-2 text-xs text-red-300">{chatError}</p>}
        </>
      )}

      {open && tab === 'direct' && !convo && (
        <ul className="flex max-h-72 min-h-24 flex-col overflow-y-auto border-t border-white/10 py-1">
          {directory.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-white/50">Nobody else is here yet. Click a player on the map to message them.</li>
          )}
          {directory.map((p) => (
            <li key={p.userId}>
              <button type="button" onClick={() => openConversation(p)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/8 focus-visible:bg-white/10 focus-visible:outline-none">
                <Head url={p.avatar} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{p.username}</span>
                    {p.here && <span title="In this space" className="size-1.5 shrink-0 rounded-full bg-emerald-400" />}
                  </span>
                  <span className="block truncate text-xs text-white/55">
                    {p.thread ? `${p.thread.fromMe ? 'You: ' : ''}${p.thread.last}` : 'Say hello'}
                  </span>
                </span>
                {(p.thread?.unread ?? 0) > 0 && (
                  <span className="rounded-full bg-emerald-400 px-1.5 text-[11px] font-bold leading-4 tabular-nums text-[#06281c]">{p.thread!.unread}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && tab === 'direct' && convo && (
        <>
          <div className="flex items-center gap-2 border-t border-white/10 px-2 py-1.5">
            <button type="button" onClick={() => setConvo(null)} aria-label="All conversations"
              className="flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
              <ArrowLeft className="size-4" />
            </button>
            <Head url={convo.person.avatar} className="size-7" />
            <span className="truncate text-sm font-bold">{convo.person.username}</span>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-white/45"><Lock className="size-3" /> Private</span>
          </div>
          <ol ref={dmListRef} aria-live="polite" className="flex max-h-64 min-h-28 flex-col gap-1.5 overflow-y-auto border-t border-white/10 px-3 py-3 text-sm">
            {convo.hasMore && (
              <li className="text-center"><button type="button" onClick={loadOlder} className="text-xs font-semibold text-emerald-300 hover:underline">Load earlier messages</button></li>
            )}
            {convo.loading && <li className="my-auto text-center text-xs text-white/50">Loading…</li>}
            {!convo.loading && convo.messages.length === 0 && (
              <li className="my-auto text-center text-white/50">Only you and {convo.person.username} can see these messages.</li>
            )}
            {convo.messages.map((m) => {
              const mine = m.from === selfId;
              return (
                <li key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <span className={cn('max-w-[85%] break-words rounded-2xl px-3 py-1.5 leading-snug',
                    mine ? 'rounded-br-md bg-emerald-400 text-[#06281c]' : 'rounded-bl-md bg-white/12 text-white')}>
                    {m.text}
                  </span>
                  <span className="mt-0.5 px-1 text-[10px] tabular-nums text-white/40">{time(m.createdAt)}</span>
                </li>
              );
            })}
          </ol>
          <Composer id="dm-input" placeholder={`Message ${convo.person.username}`} onSend={(t) => sendDm(convo.person.userId, t)} />
          {dmError && <p role="status" className="px-4 pb-2 text-xs text-red-300">{dmError}</p>}
        </>
      )}

      {open && tab === 'direct' && !convo && people.length > 0 && (
        <p className="flex items-center gap-1.5 border-t border-white/10 px-4 py-2 text-[11px] text-white/45">
          <Users className="size-3" /> Tip: click a player on the map to message them
        </p>
      )}
    </section>
  );
}

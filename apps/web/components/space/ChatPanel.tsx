"use client"
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MessageCircle, SendHorizontal } from 'lucide-react';
import { useWebSocket, ChatMessage } from '../../contexts/WebSocketsContexts';
import { cn } from '@/lib/utils';

const MAX_LENGTH = 500;
const NAME_COLORS = ['text-sky-300', 'text-amber-300', 'text-emerald-300', 'text-pink-300', 'text-violet-300', 'text-orange-300', 'text-lime-300', 'text-cyan-300'];

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

export default function ChatPanel() {
  const { chat, chatError, sendChat, selfId } = useWebSocket();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const [seen, setSeen] = useState(chat.length);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  // Enter (while not typing elsewhere) jumps into the chat box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // keep the newest message in view unless the reader has scrolled up
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
    if (open) setSeen(chat.length);
  }, [chat, open]);

  const unread = open ? 0 : chat.slice(seen).filter((m) => !m.system && m.userId !== selfId).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendChat(draft);
    setDraft('');
    stickToBottom.current = true;
  };

  return (
    <section
      aria-label="Chat"
      className="pointer-events-auto absolute bottom-4 left-4 z-30 flex w-[min(360px,calc(100%-2rem))] flex-col overflow-hidden rounded-xl bg-black/65 text-white shadow-2xl backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <MessageCircle className="size-4" />
        <span className="mr-auto">Chat</span>
        {unread > 0 && (
          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs tabular-nums">{unread} new</span>
        )}
        <ChevronDown className={cn('size-4 transition-transform', !open && 'rotate-180')} />
      </button>

      {open && (
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
              <li className="my-auto text-center text-white/50">No messages yet. Say hi 👋</li>
            )}
            {chat.map((m: ChatMessage) => m.system ? (
              <li key={m.id} className="text-center text-xs text-white/45">{m.text}</li>
            ) : (
              <li key={m.id} className="break-words leading-snug">
                <span className="mr-1.5 text-[11px] tabular-nums text-white/40">{time(m.createdAt)}</span>
                <span className={cn('font-semibold', m.userId === selfId ? 'text-emerald-300' : nameColor(m.username))}>
                  {m.userId === selfId ? 'You' : m.username}
                </span>
                <span className="text-white/90">: {m.text}</span>
              </li>
            ))}
          </ol>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 p-2">
            <label htmlFor="chat-input" className="sr-only">Message</label>
            <input
              id="chat-input"
              ref={inputRef}
              value={draft}
              maxLength={MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.currentTarget.blur();
                }
              }}
              placeholder="Press Enter to chat · Esc to move"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/15 focus:ring-2 focus:ring-blue-400/60"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 transition hover:bg-blue-600 disabled:bg-white/10 disabled:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <SendHorizontal className="size-4" />
            </button>
          </form>
          {(chatError || draft.length > MAX_LENGTH - 50) && (
            <p role="status" className={cn('px-4 pb-2 text-xs', chatError ? 'text-red-300' : 'text-white/50')}>
              {chatError || `${MAX_LENGTH - draft.length} characters left`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

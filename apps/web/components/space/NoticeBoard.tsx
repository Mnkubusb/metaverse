"use client"
import { useCallback, useEffect, useId, useState } from 'react';
import { Loader2, Pin, X } from 'lucide-react';
import { noticeAPI } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketsContexts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Notice {
  id: string;
  body: string;
  color: NoteColor;
  createdAt: string;
  author: string;
  mine: boolean;
  canDelete: boolean;
}

type NoteColor = 'yellow' | 'blue' | 'pink' | 'green' | 'white';
const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: 'bg-yellow-200',
  blue: 'bg-sky-200',
  pink: 'bg-pink-200',
  green: 'bg-lime-200',
  white: 'bg-white',
};
const MAX = 280;

// small deterministic tilt per note so the board looks hand-pinned
const tilt = (id: string) => ((id.charCodeAt(id.length - 1) + id.charCodeAt(id.length - 2)) % 5) - 2;

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function Board({ spaceId, boardId }: { spaceId: string; boardId: string }) {
  const ids = useId();
  const { boardUpdate, announceBoardUpdate } = useWebSocket();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<NoteColor>('yellow');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    noticeAPI.list(spaceId, boardId)
      .then((res) => setNotices(res.data.notices))
      .catch(() => { setNotices([]); setError("Couldn't load this board. Try again."); });
  }, [spaceId, boardId]);

  useEffect(load, [load]);
  // someone else pinned or removed a note on this board
  useEffect(() => {
    if (boardUpdate?.boardId === boardId) load();
  }, [boardUpdate, boardId, load]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setError('');
    try {
      await noticeAPI.post(spaceId, boardId, body, color);
      setDraft('');
      announceBoardUpdate(boardId);
      load();
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } }).response;
      setError(status?.data?.message ?? "Couldn't pin your note. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (n: Notice) => {
    try {
      await noticeAPI.remove(spaceId, n.id);
      setNotices((list) => list?.filter((x) => x.id !== n.id) ?? null);
      announceBoardUpdate(boardId);
    } catch {
      setError("Couldn't remove that note. Try again.");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="min-h-48 rounded-lg border-8 border-amber-900 bg-[#c9a26b] bg-[radial-gradient(#b58a52_1px,transparent_1px)] bg-[size:6px_6px] p-4 shadow-inner">
        {notices === null && <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-amber-900/60" /></div>}
        {notices?.length === 0 && (
          <p className="flex h-40 items-center justify-center text-center text-sm font-medium text-amber-950/70">
            Nothing pinned yet. Be the first to post a note.
          </p>
        )}
        {notices && notices.length > 0 && (
          <ul className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
            {notices.map((n) => (
              <li key={n.id} style={{ transform: `rotate(${tilt(n.id)}deg)` }}
                className={cn('relative flex min-h-24 flex-col gap-2 p-3 pt-4 text-sm text-gray-900 shadow-md', NOTE_COLORS[n.color] ?? NOTE_COLORS.yellow)}>
                <Pin aria-hidden className="absolute left-1/2 top-0.5 size-4 -translate-x-1/2 fill-red-500 text-red-700" />
                {n.canDelete && (
                  <button type="button" onClick={() => remove(n)} aria-label={`Remove note by ${n.author}`}
                    className="absolute right-1 top-1 rounded p-0.5 text-gray-500 hover:bg-black/10 hover:text-gray-900">
                    <X className="size-3.5" />
                  </button>
                )}
                <p className="whitespace-pre-wrap break-words leading-snug">{n.body}</p>
                <p className="mt-auto text-[11px] text-gray-600">{n.mine ? 'You' : n.author} · {timeAgo(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={post} className="grid gap-2">
        <label htmlFor={`${ids}-note`} className="text-sm font-semibold text-gray-800">Pin a note</label>
        <textarea id={`${ids}-note`} value={draft} maxLength={MAX} rows={2} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post(e); }}
          placeholder="e.g. Robotics club meets Friday 5 pm at the workshop"
          className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Note colour" className="flex gap-1.5">
            {(Object.keys(NOTE_COLORS) as NoteColor[]).map((c) => (
              <label key={c} title={c} className={cn('size-6 cursor-pointer rounded-full border-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-400',
                NOTE_COLORS[c], color === c ? 'border-gray-900' : 'border-gray-300')}>
                <input type="radio" name={`${ids}-color`} checked={color === c} onChange={() => setColor(c)} className="sr-only" aria-label={c} />
              </label>
            ))}
          </div>
          <span className="mr-auto text-xs tabular-nums text-gray-400">{draft.trim().length}/{MAX}</span>
          <button type="submit" disabled={!draft.trim() || posting}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {posting ? <Loader2 className="size-4 animate-spin" /> : <Pin className="size-4" />} Pin note
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}

export default function NoticeBoard({ spaceId, boardId, title, onClose }: {
  spaceId: string;
  boardId: string | null;
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!boardId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>Notes stay here for everyone in this space. Only you and the space owner can remove yours.</DialogDescription>
        </DialogHeader>
        {boardId && <Board spaceId={spaceId} boardId={boardId} />}
      </DialogContent>
    </Dialog>
  );
}

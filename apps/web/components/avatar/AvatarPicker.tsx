"use client"
import { useEffect, useId, useState } from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { avatarAPI, userAPI } from '../../lib/api';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Avatar {
  id: string;
  name: string;
  imageUrl: string;
}

export function AvatarSprite({ url, walking = false, className }: { url: string; walking?: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      data-walking={walking}
      className={cn('avatar-sprite', className)}
      style={{ backgroundImage: `url("${url}")` }}
    />
  );
}

// Users who never picked an avatar are drawn with the base sheet, which is the seeded "Classic" avatar.
const DEFAULT_AVATAR_URL = '/avatars/classic.png';

function PickerForm({ currentUrl: savedUrl, onSaved }: { currentUrl: string | null; onSaved: (avatar: Avatar) => void }) {
  const currentUrl = savedUrl ?? DEFAULT_AVATAR_URL;
  const ids = useId();
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [choice, setChoice] = useState<string>('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setState('loading');
    avatarAPI.getAvatars()
      .then((res) => {
        const list: Avatar[] = (res.data.avatars || []).filter((a: Avatar) => a.imageUrl);
        // the default look first, then alphabetical
        list.sort((a, b) => (a.imageUrl === DEFAULT_AVATAR_URL ? -1 : b.imageUrl === DEFAULT_AVATAR_URL ? 1 : a.name.localeCompare(b.name)));
        setAvatars(list);
        setChoice((c) => c || list.find((a) => a.imageUrl === currentUrl)?.id || list[0]?.id || '');
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = avatars.find((a) => a.id === choice);
  const unchanged = selected?.imageUrl === currentUrl;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await userAPI.updateMetadata(selected.id);
      onSaved(selected);
    } catch {
      setError("Couldn't save your avatar. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-xl">Choose your avatar</DialogTitle>
        <DialogDescription>This is how other students see you around campus.</DialogDescription>
      </DialogHeader>

      {state === 'loading' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[132px] animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-start gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 text-sm text-gray-600">
          <p>Couldn&apos;t load avatars.</p>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:underline">
            <RotateCcw className="size-3.5" /> Try again
          </button>
        </div>
      )}

      {state === 'ready' && avatars.length === 0 && (
        <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No avatars yet. An admin can add them, or run <code>pnpm db:seed</code>.</p>
      )}

      {state === 'ready' && avatars.length > 0 && (
        <fieldset>
          <legend className="sr-only">Avatars</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {avatars.map((a) => {
              const isSelected = a.id === choice;
              const isCurrent = a.imageUrl === currentUrl;
              return (
                <label
                  key={a.id}
                  onMouseEnter={() => setHovered(a.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    'relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 bg-gradient-to-b from-emerald-50 to-white px-2 pb-2.5 pt-2 transition',
                    'hover:border-blue-300 hover:shadow-md has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-200',
                    isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200',
                  )}
                >
                  <input type="radio" name={`${ids}-avatar`} value={a.id} checked={isSelected}
                    onChange={() => setChoice(a.id)} className="sr-only" />
                  <AvatarSprite url={a.imageUrl} walking={isSelected || hovered === a.id} />
                  <span className="text-sm font-semibold text-gray-900">{a.name}</span>
                  {isCurrent && <span className="text-[11px] font-medium text-emerald-700">Current</span>}
                  {isSelected && (
                    <span aria-hidden className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <DialogFooter className="gap-2">
        <DialogClose asChild>
          <button type="button" className="h-10 rounded-lg px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-200">
            Cancel
          </button>
        </DialogClose>
        <button
          type="submit"
          disabled={!selected || unchanged || saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? 'Saving…' : unchanged ? 'Current avatar' : `Wear ${selected?.name ?? 'avatar'}`}
        </button>
      </DialogFooter>
    </form>
  );
}

// Button + modal for choosing an avatar. `currentUrl` is the sprite sheet the user wears now.
export default function AvatarPicker({ currentUrl, onSaved, trigger }: {
  currentUrl: string | null;
  onSaved?: (avatar: Avatar) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {open && (
          <PickerForm
            currentUrl={currentUrl}
            onSaved={(a) => {
              onSaved?.(a);
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

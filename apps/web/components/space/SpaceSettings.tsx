"use client"
import { useEffect, useId, useState } from 'react';
import { Check, Copy, Globe, Link2, Loader2, Lock, RotateCcw, UserMinus } from 'lucide-react';
import { inviteLink, spaceAPI, Visibility } from '../../lib/api';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { AvatarSprite } from '../avatar/AvatarPicker';
import { cn } from '@/lib/utils';

export const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: 'Private', label: 'Private', hint: 'Only members. Share the invite link to add people.', icon: <Lock className="size-4" /> },
  { value: 'Unlisted', label: 'Anyone with the link', hint: 'Not listed anywhere, but the link works for any logged-in student.', icon: <Link2 className="size-4" /> },
  { value: 'Public', label: 'Public', hint: 'Anyone can find it on the Explore page.', icon: <Globe className="size-4" /> },
];

export function VisibilityPicker({ value, onChange, name }: { value: Visibility; onChange: (v: Visibility) => void; name: string }) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {VISIBILITY_OPTIONS.map((o) => (
        <label key={o.value} className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg border-2 px-3 py-2.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-200',
          value === o.value ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 hover:border-blue-300',
        )}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          <span className={cn('mt-0.5', value === o.value ? 'text-blue-600' : 'text-gray-500')}>{o.icon}</span>
          <span>
            <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
            <span className="block text-xs text-gray-500">{o.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

interface Member {
  userId: string;
  username: string;
  avatar: string | null;
  role: 'Owner' | 'Member';
}

export interface SpaceSettingsValue {
  name: string;
  visibility: Visibility;
  inviteCode: string | null;
}

function SettingsForm({ spaceId, initial, onChange }: {
  spaceId: string;
  initial: SpaceSettingsValue;
  onChange: (v: SpaceSettingsValue) => void;
}) {
  const ids = useId();
  const [name, setName] = useState(initial.name);
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [inviteCode, setInviteCode] = useState(initial.inviteCode);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    spaceAPI.getMembers(spaceId).then((res) => setMembers(res.data.members)).catch(() => setMembers([]));
  }, [spaceId]);

  const dirty = name.trim() !== initial.name || visibility !== initial.visibility;
  const link = inviteLink(spaceId, visibility === 'Private' ? inviteCode : null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ kind: 'error', text: 'Give the space a name.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await spaceAPI.updateSpace(spaceId, { name: name.trim(), visibility });
      onChange({ name: res.data.name, visibility: res.data.visibility, inviteCode });
      setMessage({ kind: 'ok', text: 'Saved.' });
    } catch {
      setMessage({ kind: 'error', text: "Couldn't save. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  };

  const reset = async () => {
    try {
      const res = await spaceAPI.resetInvite(spaceId);
      setInviteCode(res.data.inviteCode);
      onChange({ name: initial.name, visibility: initial.visibility, inviteCode: res.data.inviteCode });
      setMessage({ kind: 'ok', text: 'New invite link created. The old link no longer works; current members keep access.' });
    } catch {
      setMessage({ kind: 'error', text: "Couldn't reset the link. Try again." });
    }
  };

  const remove = async (m: Member) => {
    try {
      await spaceAPI.removeMember(spaceId, m.userId);
      setMembers((list) => list?.filter((x) => x.userId !== m.userId) ?? null);
    } catch {
      setMessage({ kind: 'error', text: `Couldn't remove ${m.username}. Try again.` });
    }
  };

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-xl">Space settings</DialogTitle>
        <DialogDescription>Only you, the owner, can see these.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <label htmlFor={`${ids}-name`} className="text-sm font-semibold text-gray-800">Name</label>
        <input id={`${ids}-name`} value={name} maxLength={100} onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-lg border border-gray-300 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold text-gray-800">Who can enter</legend>
        <VisibilityPicker value={visibility} onChange={setVisibility} name={`${ids}-visibility`} />
      </fieldset>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-gray-800">Invite link</p>
        <div className="flex gap-2">
          <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-xs text-gray-700" />
          <button type="button" onClick={copy}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {visibility === 'Private' && (
          <button type="button" onClick={reset} className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900">
            <RotateCcw className="size-3.5" /> Reset link (the old one stops working)
          </button>
        )}
        {dirty && visibility !== initial.visibility && (
          <p className="text-xs text-amber-700">Save to apply the new setting to this link.</p>
        )}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-gray-800">Members {members && <span className="font-normal text-gray-500">({members.length})</span>}</p>
        <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
          {members === null && <li className="px-3 py-2 text-sm text-gray-500">Loading…</li>}
          {members?.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-3 py-1.5">
              <span className="relative size-8 overflow-hidden rounded bg-emerald-50">
                <AvatarSprite url={m.avatar ?? '/avatars/classic.png'} className="absolute -left-6 -top-3" />
              </span>
              <span className="mr-auto text-sm font-medium text-gray-900">{m.username}</span>
              {m.role === 'Owner'
                ? <span className="text-xs font-semibold text-emerald-700">Owner</span>
                : (
                  <button type="button" onClick={() => remove(m)} aria-label={`Remove ${m.username}`}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                    <UserMinus className="size-3.5" /> Remove
                  </button>
                )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">Removed members can come back through a public or unlisted link, or a new invite link.</p>
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={cn('rounded-lg px-3 py-2 text-sm',
          message.kind === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800')}>
          {message.text}
        </p>
      )}

      <DialogFooter>
        <button type="submit" disabled={!dirty || saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {saving && <Loader2 className="size-4 animate-spin" />} Save changes
        </button>
      </DialogFooter>
    </form>
  );
}

export default function SpaceSettings({ spaceId, value, onChange, trigger }: {
  spaceId: string;
  value: SpaceSettingsValue;
  onChange: (v: SpaceSettingsValue) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {open && <SettingsForm spaceId={spaceId} initial={value} onChange={onChange} />}
      </DialogContent>
    </Dialog>
  );
}

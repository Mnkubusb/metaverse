"use client"
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Map as MapIcon, Plus, RotateCcw, Square } from 'lucide-react';
import { spaceAPI, mapAPI, Visibility } from '../../lib/api';
import { VisibilityPicker } from './SpaceSettings';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface MapTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string;
}

// Seeded by packages/db/scripts/seed.js; preselected when available.
const DEFAULT_MAP_ID = 'gec-bilaspur-campus';
const EMPTY = 'empty';
const MAX_SIDE = 200;
const SIZE_PRESETS = [
  { id: 'small', label: 'Small', w: 20, h: 15 },
  { id: 'medium', label: 'Medium', w: 40, h: 30 },
  { id: 'large', label: 'Large', w: 80, h: 60 },
] as const;
type PresetId = (typeof SIZE_PRESETS)[number]['id'] | 'custom';

const NAME_SUGGESTIONS = ['CSE study group', 'Mining batch hangout', 'Hostel game night', 'Project review'];

function errorMessage(err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403) return 'Your session has expired. Log in again to create a space.';
  if (status === 404) return 'That map is no longer available. Pick another one.';
  if (status === 400) return 'Check the name and size, then try again.';
  return "Couldn't create the space. Check your connection and try again.";
}

function CreateSpaceForm() {
  const router = useRouter();
  const ids = useId();
  const [name, setName] = useState('');
  const [maps, setMaps] = useState<MapTemplate[]>([]);
  const [mapsState, setMapsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [choice, setChoice] = useState('');
  const [preset, setPreset] = useState<PresetId>('medium');
  const [visibility, setVisibility] = useState<Visibility>('Unlisted');
  const [custom, setCustom] = useState({ w: 30, h: 20 });
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [placeholder] = useState(() => NAME_SUGGESTIONS[Math.floor(Math.random() * NAME_SUGGESTIONS.length)]);

  const loadMaps = () => {
    setMapsState('loading');
    mapAPI.getMaps()
      .then((res) => {
        const list: MapTemplate[] = (res.data.maps || []).map((m: MapTemplate) => ({
          id: m.id, name: m.name, width: m.width, height: m.height, thumbnail: m.thumbnail,
        }));
        // campus first, then the rest alphabetically
        list.sort((a, b) => (a.id === DEFAULT_MAP_ID ? -1 : b.id === DEFAULT_MAP_ID ? 1 : a.name.localeCompare(b.name)));
        setMaps(list);
        setChoice((current) => current || (list[0]?.id ?? EMPTY));
        setMapsState('ready');
      })
      .catch(() => {
        setMapsState('error');
        setChoice((current) => current || EMPTY);
      });
  };
  useEffect(loadMaps, []);

  const size = preset === 'custom' ? custom : SIZE_PRESETS.find((p) => p.id === preset)!;
  const trimmed = name.trim();
  const nameError = !trimmed ? 'Give your space a name.' : trimmed.length > 100 ? 'Keep the name to 100 characters or fewer.' : '';
  const sizeValid = [size.w, size.h].every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_SIDE);
  const sizeError = choice === EMPTY && !sizeValid ? `Width and height must be whole numbers from 1 to ${MAX_SIDE}.` : '';
  const selectedMap = maps.find((m) => m.id === choice);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameError || sizeError || !choice) return;
    setSubmitting(true);
    setError('');
    try {
      const dimensions = selectedMap ? `${selectedMap.width}x${selectedMap.height}` : `${size.w}x${size.h}`;
      const res = await spaceAPI.createSpace(trimmed, dimensions, selectedMap?.id ?? '', visibility);
      router.push(`/space/${res.data.spaceId}`);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const cardBase =
    'relative flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left transition-all cursor-pointer ' +
    'hover:border-blue-300 hover:shadow-md has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-200';

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-xl">Create a space</DialogTitle>
        <DialogDescription>Name it, pick a map, and you&apos;ll walk straight in.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={`${ids}-name`} className="text-sm font-semibold text-gray-800">Name</label>
          <span className={cn('text-xs tabular-nums', trimmed.length > 100 ? 'text-red-600' : 'text-gray-400')}>{trimmed.length}/100</span>
        </div>
        <input
          id={`${ids}-name`}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={`e.g. ${placeholder}`}
          aria-invalid={touched && !!nameError}
          aria-describedby={`${ids}-name-error`}
          className="h-11 rounded-lg border border-gray-300 px-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-100"
        />
        <p id={`${ids}-name-error`} className="min-h-4 text-xs text-red-600">{touched ? nameError : ''}</p>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-semibold text-gray-800">Map</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mapsState === 'loading' && [0, 1].map((i) => (
            <div key={i} className="aspect-[76/68] animate-pulse rounded-xl border-2 border-gray-100 bg-gray-50" aria-hidden />
          ))}

          {mapsState === 'ready' && maps.map((map) => {
            const selected = choice === map.id;
            return (
              <label key={map.id} className={cn(cardBase, selected ? 'border-blue-500 shadow-md' : 'border-gray-200')}>
                <input type="radio" name={`${ids}-map`} value={map.id} checked={selected}
                  onChange={() => setChoice(map.id)} className="sr-only" />
                <div className="relative aspect-[76/54] w-full bg-gray-100">
                  {map.thumbnail
                    ? <img src={map.thumbnail} alt="" className="h-full w-full object-cover [image-rendering:pixelated]" />
                    : <MapIcon className="absolute inset-0 m-auto size-8 text-gray-300" />}
                  {map.id === DEFAULT_MAP_ID && (
                    <span className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white shadow">Recommended</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{map.name}</p>
                    <p className="text-xs tabular-nums text-gray-500">{map.width} × {map.height} tiles</p>
                  </div>
                  <SelectedDot selected={selected} />
                </div>
              </label>
            );
          })}

          {mapsState === 'error' && (
            <div className="flex flex-col items-start justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-4 text-sm text-gray-600">
              <p>Couldn&apos;t load map templates.</p>
              <button type="button" onClick={loadMaps} className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:underline">
                <RotateCcw className="size-3.5" /> Try again
              </button>
            </div>
          )}

          <label className={cn(cardBase, choice === EMPTY ? 'border-blue-500 shadow-md' : 'border-gray-200')}>
            <input type="radio" name={`${ids}-map`} value={EMPTY} checked={choice === EMPTY}
              onChange={() => setChoice(EMPTY)} className="sr-only" />
            <div className="hidden aspect-[76/54] w-full items-center justify-center bg-gray-50 sm:flex bg-[linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px]">
              <Square className="size-8 text-gray-300" strokeWidth={1.5} />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <Square className="size-5 shrink-0 text-gray-400 sm:hidden" strokeWidth={1.5} aria-hidden />
              <div className="mr-auto">
                <p className="font-semibold text-gray-900">Empty space</p>
                <p className="text-xs text-gray-500">Start from a blank grid</p>
              </div>
              <SelectedDot selected={choice === EMPTY} />
            </div>
          </label>
        </div>

        {choice === EMPTY && (
          <div className="grid gap-3 rounded-xl bg-gray-50 p-4">
            <p id={`${ids}-size-label`} className="text-sm font-semibold text-gray-800">Size</p>
            <div role="radiogroup" aria-labelledby={`${ids}-size-label`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...SIZE_PRESETS, { id: 'custom' as const, label: 'Custom' }].map((p) => (
                <label key={p.id} className={cn(
                  'cursor-pointer rounded-lg border-2 bg-white px-3 py-2 text-sm transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-200',
                  preset === p.id ? 'border-blue-500' : 'border-gray-200 hover:border-blue-300')}>
                  <input type="radio" name={`${ids}-size`} checked={preset === p.id} onChange={() => setPreset(p.id)} className="sr-only" />
                  <span className="block font-semibold text-gray-900">{p.label}</span>
                  <span className="block text-xs tabular-nums text-gray-500">{'w' in p ? `${p.w} × ${p.h}` : 'Set your own'}</span>
                </label>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex flex-wrap items-end gap-2">
                <NumberField id={`${ids}-w`} label="Width" value={custom.w} onChange={(w) => setCustom((c) => ({ ...c, w }))} />
                <span className="pb-2.5 text-gray-400">×</span>
                <NumberField id={`${ids}-h`} label="Height" value={custom.h} onChange={(h) => setCustom((c) => ({ ...c, h }))} />
                <span className="pb-2.5 text-sm text-gray-500">tiles</span>
              </div>
            )}
            {sizeError && <p className="text-xs text-red-600">{sizeError}</p>}
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold text-gray-800">Who can enter</legend>
        <VisibilityPicker value={visibility} onChange={setVisibility} name={`${ids}-visibility`} />
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* pinned so the actions stay reachable when the form scrolls on small screens */}
      <DialogFooter className="sticky -bottom-6 z-10 -mx-6 -mb-6 gap-2 border-t bg-background px-6 py-4">
        <DialogClose asChild>
          <button type="button" className="h-10 rounded-lg px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-200">
            Cancel
          </button>
        </DialogClose>
        <button type="submit" disabled={submitting || mapsState === 'loading'}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Creating…' : 'Create & join'}
        </button>
      </DialogFooter>
    </form>
  );
}

function SelectedDot({ selected }: { selected: boolean }) {
  return (
    <span aria-hidden className={cn(
      'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition',
      selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300')}>
      {selected && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs text-gray-600">{label}</label>
      <input id={id} type="number" inputMode="numeric" min={1} max={MAX_SIDE} value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-10 w-24 rounded-lg border border-gray-300 bg-white px-3 tabular-nums outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </div>
  );
}

// "New space" button that opens the create-space modal. Pass `trigger` to use a different button.
export default function CreateSpaceDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
            <Plus className="size-4" /> New space
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {/* mounted only while open, so every visit starts with a fresh form */}
        {open && <CreateSpaceForm />}
      </DialogContent>
    </Dialog>
  );
}

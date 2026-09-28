import type { spaceElement } from '@/components/space/SpaceElement';

// Human names for landmark elements of the seeded GEC Bilaspur campus map (element ids from the seed).
const PLACE_NAMES: Record<string, string> = {
  'campus-admin-block': 'Administrative Block',
  'campus-central-library': 'Central Library',
  'campus-auditorium': 'Auditorium',
  'campus-dept-civil': 'Civil Engineering',
  'campus-dept-mechanical': 'Mechanical Engineering',
  'campus-dept-mining': 'Mining Engineering',
  'campus-dept-electrical': 'Electrical Engineering',
  'campus-dept-cse': 'Computer Science & Engineering',
  'campus-dept-it': 'Information Technology',
  'campus-dept-etc': 'Electronics & Telecom',
  'campus-workshop': 'Central Workshop',
  'campus-canteen': 'Canteen',
  'campus-dispensary': 'Dispensary',
  'campus-boys-hostel-1': 'Boys Hostel 1',
  'campus-boys-hostel-2': 'Boys Hostel 2',
  'campus-first-year-hostel': 'First Year Hostel',
  'campus-girls-hostel-1': 'Girls Hostel 1',
  'campus-girls-hostel-2': 'Girls Hostel 2',
  'campus-sports-ground': 'Sports Ground',
  'campus-basketball-court': 'Basketball Court',
  'campus-pond': 'Pond Garden',
  'campus-fountain': 'Main Plaza',
  'campus-parking': 'Parking',
  'campus-gate-arch': 'Main Gate',
};

export interface Place {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function findPlaces(elements: spaceElement[]): Place[] {
  return elements
    .filter((e) => PLACE_NAMES[e.element.id])
    .map((e) => ({ name: PLACE_NAMES[e.element.id]!, x: e.x, y: e.y, w: e.element.width, h: e.element.height }));
}

// Closest landmark within `range` tiles of (x, y), measured to the edge of its footprint.
export function nearestPlace(places: Place[], x: number, y: number, range = 3): string | null {
  let best: { name: string; d: number } | null = null;
  for (const p of places) {
    const dx = Math.max(p.x - x, 0, x - (p.x + p.w - 1));
    const dy = Math.max(p.y - y, 0, y - (p.y + p.h - 1));
    const d = Math.max(dx, dy);
    if (d <= range && (!best || d < best.d)) best = { name: p.name, d };
  }
  return best?.name ?? null;
}

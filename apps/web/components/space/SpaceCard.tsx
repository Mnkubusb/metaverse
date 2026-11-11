/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * A space as a card: its map thumbnail (pixel art, cropped to the middle of the campus),
 * the name, and one line of detail. `actions` renders below the link, outside it, so
 * buttons inside the card stay separate tab stops.
 */
export default function SpaceCard({ href, name, thumbnail, detail, badge, actions, className }: {
  href: string;
  name: string;
  thumbnail?: string | null;
  detail?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn(
      'group relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border transition-[box-shadow,transform] duration-200 ease-out',
      'hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-14px_rgb(22_70_52/0.45)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring',
      className,
    )}>
      <div className="relative aspect-[16/10] overflow-hidden bg-[#84c669]">
        {thumbnail ? (
          <img src={thumbnail} alt="" loading="lazy"
            className="size-full scale-[1.6] object-cover [image-rendering:pixelated] transition-transform duration-500 ease-out group-hover:scale-[1.7]" />
        ) : null}
        {badge && <div className="absolute left-2.5 top-2.5">{badge}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-4 pb-4 pt-3">
        <h3 className="truncate text-base font-bold text-foreground">
          <Link href={href} className="outline-none after:absolute after:inset-0 after:content-['']">{name}</Link>
        </h3>
        {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
        {actions && <div className="relative z-10 mt-3 flex items-center gap-2">{actions}</div>}
      </div>
    </article>
  );
}

export function VisibilityBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-plate/95 px-2 py-0.5 text-xs font-bold text-sign-deep shadow-[0_1px_0_rgb(15_50_38/0.3)]">
      {label}
    </span>
  );
}

export function SpaceGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
          <div className="aspect-[16/10] animate-pulse bg-muted" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client"
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { spaceAPI } from '../../lib/api';
import CreateSpaceDialog from './spaceCreator';
import SpaceCard, { SpaceGridSkeleton, VisibilityBadge } from './SpaceCard';
import { Trash2 } from 'lucide-react';

export interface Space{
    id: string;
    name: string;
    dimensions: string;
    thumbnail: string;
    visibility?: 'Private' | 'Unlisted' | 'Public';
}

export const VISIBILITY_LABEL = { Private: 'Private', Unlisted: 'Link only', Public: 'Public' } as const;

export default function SpacesList() {
  const [spaces, setSpaces] = useState<Space[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteInProgress, setDeleteInProgress] = useState("");

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    try {
      const response = await spaceAPI.getAllSpaces();
      setSpaces(response.data.spaces || []);
    } catch (err) {
      setError('Failed to load spaces');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (spaceId : string) => {
    if (!confirm('Delete this space? Everyone in it is removed and its notes are lost.')) return;
    
    setDeleteInProgress(spaceId);
    
    try {
      await spaceAPI.deleteSpace(spaceId);
      setSpaces(spaces.filter(space => space.id !== spaceId));
    } catch (err) {
      setError('Failed to delete space');
      console.error(err);
    } finally {
      setDeleteInProgress("");
    }
  };

  if (loading) return <SpaceGridSkeleton />;
  return (
    <div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-brick/25 bg-brick/8 px-3 py-2 text-sm text-brick">{error}</p>}
      {spaces.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-border p-8">
          <p className="font-bold">No spaces yet</p>
          <p className="max-w-[56ch] text-sm text-muted-foreground">Create one from the GEC Bilaspur campus map and invite your friends.</p>
          <CreateSpaceDialog />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <li key={space.id}>
              <SpaceCard
                href={`/space/${space.id}`}
                name={space.name}
                thumbnail={space.thumbnail}
                detail={`${space.dimensions.replace('x', ' × ')} tiles`}
                badge={space.visibility && <VisibilityBadge label={VISIBILITY_LABEL[space.visibility]} />}
                actions={
                  <>
                    <Link href={`/space/${space.id}`}
                      className="inline-flex h-9 items-center rounded-lg bg-sign px-4 text-sm font-bold text-plate transition-colors hover:bg-sign-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      Enter
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(space.id)}
                      disabled={deleteInProgress === space.id}
                      className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-brick transition-colors hover:bg-brick/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick/40 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Trash2 className="size-4" /> {deleteInProgress === space.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

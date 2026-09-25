"use client";
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Lock, MapPinOff } from 'lucide-react';
import MainLayout from '../../../components/layout/MainLayout';
import ProtectedRoute from '../../../components/auth/protectedRoute';
import SpaceGrid from '../../../components/space/spaceGrid';
import { spaceAPI } from '../../../lib/api';
import { WebSocketProvider } from '../../../contexts/WebSocketsContexts';

type Gate = 'checking' | 'ok' | 'private' | 'missing' | 'error';

function Blocked({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
        <div className="flex min-h-[70vh] items-center justify-center p-6">
            <div className="grid max-w-md justify-items-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">{icon}</div>
                <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                <p className="text-gray-600">{body}</p>
                <div className="mt-2 flex gap-2">
                    <Link href="/explore" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">Explore public spaces</Link>
                    <Link href="/spaces" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">My spaces</Link>
                </div>
            </div>
        </div>
    );
}

// Registers the visit (and redeems an invite code from the link) before connecting to the space.
function SpaceGate({ id }: { id: string }) {
    const [gate, setGate] = useState<Gate>('checking');

    useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams(window.location.search);
        const invite = params.get('invite') ?? undefined;
        spaceAPI.joinSpace(id, invite)
            .then(() => {
                if (cancelled) return;
                // don't leave the invite code in the address bar where it's easy to share by accident
                if (invite) window.history.replaceState(null, '', `/space/${id}`);
                setGate('ok');
            })
            .catch((err) => {
                if (cancelled) return;
                const status = err?.response?.status;
                setGate(status === 403 ? 'private' : status === 404 ? 'missing' : 'error');
            });
        return () => { cancelled = true; };
    }, [id]);

    if (gate === 'checking') {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
            </div>
        );
    }
    if (gate === 'private') {
        return <Blocked icon={<Lock className="size-6" />} title="This space is private"
            body="Only members can enter. Ask the owner for an invite link, or check that you copied the whole link." />;
    }
    if (gate === 'missing') {
        return <Blocked icon={<MapPinOff className="size-6" />} title="Space not found"
            body="It may have been deleted, or the link is wrong." />;
    }
    if (gate === 'error') {
        return <Blocked icon={<MapPinOff className="size-6" />} title="Couldn't open this space"
            body="Check your connection and reload the page." />;
    }

    return (
        <div className="mx-auto">
            <WebSocketProvider spaceId={id} key={id}>
                <SpaceGrid id={id} />
            </WebSocketProvider>
        </div>
    );
}

export default function SpacePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <ProtectedRoute>
            <MainLayout>
                <SpaceGate id={id} />
            </MainLayout>
        </ProtectedRoute>
    );
}

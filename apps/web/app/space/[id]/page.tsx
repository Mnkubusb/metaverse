"use client";
import { useState, useEffect, use } from 'react';
import MainLayout from '../../../components/layout/MainLayout';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/auth/protectedRoute';
import SpaceGrid from '../../../components/space/spaceGrid';
import { spaceAPI } from '../../../lib/api';
import { WebSocketProvider } from '../../../contexts/WebSocketsContexts';



// Main Space Page component
export default function SpacePage({ params }: {
    params: Promise<{
        id: string
    }>;
}) {
    const router = useRouter();
    const { id } = use(params);
    const [space, setSpace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        const fetchSpace = async () => {
            try {
                setLoading(true);
                const response = await spaceAPI.getSpace(id as string);
                setSpace(response.data);
            } catch (error) {
                console.error('Error fetching space:', error);
                setError('Failed to load space. It may have been deleted or you don\'t have permission to access it.');
            } finally {
                setLoading(false);
            }
        };
        fetchSpace();
    }, [id]);


    if (loading) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            </MainLayout>
        );
    }

    if (error) {
        return (
            <MainLayout>
                <div className="max-w-4xl mx-auto text-center">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                    <button
                        onClick={() => router.push('/spaces')}
                        className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
                    >
                        Back to Spaces
                    </button>
                </div>
            </MainLayout>
        );
    }


    if (!space) return null;

    return (
        <ProtectedRoute>
            <MainLayout>
                <div className="mx-auto">
                    <WebSocketProvider spaceId={id} key={id}>
                        <SpaceGrid id={id} />
                    </WebSocketProvider>
                </div>
            </MainLayout>
        </ProtectedRoute>
    );
}
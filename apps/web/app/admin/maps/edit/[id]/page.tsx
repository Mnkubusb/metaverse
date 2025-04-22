import MapEditor from "../../../../../components/admin/MapEditor"
import ProtectedRoute from "../../../../../components/auth/protectedRoute"
import MainLayout from "../../../../../components/layout/MainLayout"

const EditPage = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    return (
        <ProtectedRoute adminOnly>
            <MainLayout>
                {id && <MapEditor mapId={id as string} />}
            </MainLayout>
        </ProtectedRoute>
    )
}

export default EditPage
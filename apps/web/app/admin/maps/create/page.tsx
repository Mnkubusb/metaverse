import MapEditor from "../../../../components/admin/MapEditor"
import ProtectedRoute from "../../../../components/auth/protectedRoute"
import MainLayout from "../../../../components/layout/MainLayout"


const CreatePage = () => {
  return (
    <ProtectedRoute adminOnly>
      <MainLayout>
        <MapEditor />
      </MainLayout>
    </ProtectedRoute>
  )
}

export default CreatePage

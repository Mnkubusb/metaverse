"use client";
import MainLayout from '../../components/layout/MainLayout';
import ProtectedRoute from '../../components/auth/protectedRoute';
import SpacesList from '../../components/space/spaceLists';
import SpaceCreator from '../../components/space/spaceCreator';



export default function Spaces() {

  //     try {
  //       await spaceAPI.createSpace(
  //         spaceData.name,
  //         spaceData.dimensions,
  //         spaceData.mapId
  //       );
  //       setShowCreateForm(false);
  //       fetchSpaces();
  //     } catch (error) {
  //       console.error('Error creating space:', error);
  //     }
  //   };

  //   const handleDeleteSpace = async (spaceId : string) => {
  //     if (window.confirm('Are you sure you want to delete this space?')) {
  //       try {
  //         await spaceAPI.deleteSpace(spaceId);
  //         setSpaces(spaces.filter(space => space.id !== spaceId));
  //       } catch (error) {
  //         console.error('Error deleting space:', error);
  //       }
  //     }
  //   };

  return (
    <ProtectedRoute>
      <MainLayout>
        <div className="p-6 flex justify-center items-center">
          <SpaceCreator />
          <SpacesList />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
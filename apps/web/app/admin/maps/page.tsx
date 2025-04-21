"use client"
import MainLayout from '../../../components/layout/MainLayout';
import ProtectedRoute from '../../../components/auth/protectedRoute';
import MapManager from '../../../components/admin/MapManager';


export default function Map() {
  
  return (
    <ProtectedRoute adminOnly={true}>
      <MainLayout>
        <MapManager />
      </MainLayout>
    </ProtectedRoute>
  );
}
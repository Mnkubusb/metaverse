"use client"
import MainLayout from '../../../components/layout/MainLayout';
import ProtectedRoute from '../../../components/auth/protectedRoute';
import AvatarManager from '../../../components/admin/avatarManager';

export default function Avatar() {
  return (
    <ProtectedRoute adminOnly={true}>
      <MainLayout>
        <AvatarManager />
      </MainLayout>
    </ProtectedRoute>
  );
}
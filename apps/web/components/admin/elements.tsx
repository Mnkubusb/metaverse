
import React from 'react';
import MainLayout from '../../components/layout/MainLayout';
import ElementManager from '../../components/admin/ElementsManager';
import ProtectedRoute from '../../components/auth/protectedRoute';

const AdminElementsPage = () => {
  return (
    <ProtectedRoute adminOnly>
      <MainLayout>
        <ElementManager />
      </MainLayout>
    </ProtectedRoute>
  );
};

export default AdminElementsPage;
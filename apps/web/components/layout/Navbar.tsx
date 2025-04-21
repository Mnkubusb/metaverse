import Link from 'next/link';
import { useAuth } from '../../contexts/authContext';

export default function Navbar() {
  const { isAuthenticated, isAdmin, logout } = useAuth();

  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Metaverse Platform
        </Link>
        
        <div className="flex space-x-4">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="hover:text-blue-200">
                Dashboard
              </Link>
              <Link href="/spaces" className="hover:text-blue-200">
                Spaces
              </Link>
              
              {isAdmin && (
                <>
                  <Link href="/admin/dashboard" className="hover:text-blue-200">
                    Admin
                  </Link>
                </>
              )}
              
              <button 
                onClick={logout}
                className="hover:text-blue-200"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-blue-200">
                Login
              </Link>
              <Link href="/signup" className="hover:text-blue-200">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
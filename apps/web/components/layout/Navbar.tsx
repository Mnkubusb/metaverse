import Link from 'next/link';
import { useAuth } from '../../contexts/authContext';
import { usePathname } from 'next/navigation';
import { MdAdminPanelSettings, MdDashboard, MdSpaceDashboard } from 'react-icons/md';
import { BiLogIn, BiLogOut } from 'react-icons/bi';
import { FaRegistered } from 'react-icons/fa';

export default function Navbar() {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const isSpace = usePathname().includes('space');

  return (
    <nav className={`"bg-white font-geist-sans text-black drop-shadow-xl shadow-lg flex items-center " + ${isSpace ? 'w-14 h-screen flex-col' : 'h-16 p-8 px-44'}`} >
      <Link href="/" className={"text-xl font-bold "  + (isSpace ? 'mt-5' : 'flex justify-center items-center gap-2')  }>
        {isSpace ? <>
          <img src="/logoipsum-371.svg" alt="Metaverse" className="w-10 h-10" /> </> : <><img src="/logoipsum-371.svg" alt="Metaverse" className="w-10 h-10" /> Metaverse </>}
      </Link>
      <div className={"flex gap-4 p-2 font-geist-sans w-full justify-between " + (isSpace ? 'flex-col ' : ' space-x-4 ml-20')}>
        {isAuthenticated ? (
          <>
            <div className={`${isSpace ? 'flex flex-col gap-8 mt-10' : 'flex'} `}>
              <Link href="/dashboard" className="hover:bg-gray-100 rounded-md p-[6px] px-3 w-fit">
                {isSpace ? <>
                  <MdDashboard size={16} />
                </>
                  : 
                <div className='flex gap-2 justify-center items-center'>
                    <MdDashboard size={16} />
                    Dashboard
                </div>
                }
              </Link>
              <Link href="/spaces" className="hover:bg-gray-100 rounded-md p-[6px] px-3 w-fit">
                {isSpace ? <>
                  <MdSpaceDashboard size={16} />
                </>
                  : <div className='flex gap-2 justify-center items-center'>
                  <MdSpaceDashboard size={16} />
                  Spaces
              </div>}
              </Link>
              {isAdmin && (
                <>
                  <Link href="/admin/dashboard" className="hover:bg-gray-100 rounded-md p-[6px] px-3 w-fit">
                    {isSpace ? <>
                      <MdAdminPanelSettings size={16} />
                    </>
                      : <div className='flex gap-2 justify-center items-center'>
                      <MdAdminPanelSettings size={16} />
                      Admin
                  </div>}
                  </Link>
                </>
              )}
            </div>
            <div className={`${isSpace ? 'mt-80' : ''} `}>
              <button
                onClick={logout}
                className="hover:bg-gray-100 rounded-md p-[6px] px-3 w-fit cursor-pointer"
              >
                {isSpace ? <>
                  <BiLogOut size={16} />
                </>
                  :<div className='flex gap-2 justify-center items-center'>
                 logOut
                    <BiLogOut size={16} />
              </div>}
              </button>
            </div>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:bg-gray-100 rounded-md p-[6px] px-3 ml-auto w-fit">
              {isSpace ? <>
                <BiLogIn size={16} />
              </>
                : 'LogIn'}
            </Link>
            <Link href="/signup" className="hover:bg-gray-100 rounded-md p-[6px] px-3 ml-auto w-fit">
              {isSpace ? <>
                <FaRegistered size={16} />
              </>
                : 'SignUp'}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
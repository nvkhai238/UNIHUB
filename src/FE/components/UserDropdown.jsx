import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../api/api';
import { getCurrentUser } from '../router/jwtUtils';
import ChangePasswordModal from './ChangePasswordModal';

export default function UserDropdown({ onLoggedOut }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef(null);
  const user = getCurrentUser();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    if (onLoggedOut) {
      onLoggedOut();
    }
    navigate('/login');
  };

  const firstLetter = user.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 transition hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        aria-label="User menu"
      >
        {firstLetter}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-gray-900">{user.email}</p>
            <p className="truncate text-xs text-gray-500">{user.role}</p>
          </div>

          {user.role === 'STUDENT' && (
            <Link
              to="/student/profile"
              onClick={() => setIsOpen(false)}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Hồ sơ sinh viên
            </Link>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              setIsModalOpen(true);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            Đổi mật khẩu
          </button>

          {user.role !== 'STUDENT' && (
            <button
              onClick={handleLogout}
              className="block w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Đăng xuất
            </button>
          )}
        </div>
      )}

      <ChangePasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

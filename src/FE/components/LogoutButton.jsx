import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/api';
import { useToast } from './Toast';

export default function LogoutButton({
  className = '',
  onLoggedOut,
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await logout();
      if (onLoggedOut) {
        await onLoggedOut();
      }

      addToast({
        type: 'success',
        title: 'Đăng xuất thành công',
        message: 'Phiên làm việc đã được kết thúc.',
      });
      navigate('/login', { replace: true });
    } catch {
      addToast({
        type: 'error',
        title: 'Không thể đăng xuất',
        message: 'Vui lòng thử lại sau ít phút.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={submitting}
      className={[
        'rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      ].join(' ')}
    >
      {submitting ? 'Đang đăng xuất...' : 'Đăng xuất'}
    </button>
  );
}

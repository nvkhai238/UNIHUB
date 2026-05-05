import { useNavigate } from 'react-router-dom';
import { getCurrentRole } from '../../router/jwtUtils';
import { ROLE_HOME } from '../../router/constants';

/**
 * UnauthorizedPage — hiển thị khi user đã đăng nhập nhưng role không đủ quyền.
 * Ví dụ: STUDENT cố truy cập /admin → redirect về đây.
 */
export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const homeRoute = role ? ROLE_HOME[role] : '/';

  return (
    <div>
      <h1>Không có quyền truy cập</h1>
      <p>Bạn không có quyền xem trang này.</p>
      <button onClick={() => navigate(homeRoute, { replace: true })}>
        Về trang chủ
      </button>
    </div>
  );
}

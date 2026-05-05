import { useNavigate, useLocation } from 'react-router-dom';
import { saveTokens } from '../../router/jwtUtils';
import { ROLE_HOME } from '../../router/constants';

/**
 * LoginPage — trang đăng nhập dùng chung cho cả 3 role.
 *
 * Sau khi POST /api/auth/login thành công:
 *   1. Lưu accessToken + refreshToken vào localStorage (qua saveTokens)
 *   2. Đọc role từ response.data.user.role
 *   3. Redirect về trang gốc (state.from) hoặc homepage theo role
 *
 * Blueprint §auth.md — Response 200:
 * {
 *   "status": 200,
 *   "data": {
 *     "accessToken": "...",
 *     "refreshToken": "...",
 *     "user": { "id", "email", "fullName", "role" }
 *   }
 * }
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // After login, go back to where the user tried to go (or role home)
  function handleLoginSuccess({ accessToken, refreshToken, user }) {
    saveTokens({ accessToken, refreshToken });
    const from = location.state?.from?.pathname ?? ROLE_HOME[user.role] ?? '/';
    navigate(from, { replace: true });
  }

  return (
    <div>
      {/* TODO: implement login form — call POST /api/auth/login, then handleLoginSuccess() */}
      <h1>Đăng nhập UniHub</h1>
    </div>
  );
}

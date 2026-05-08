import { useState, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../../api/api';
import { ROLE_HOME } from '../../router/constants';
import { useToast } from '../../components/Toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast({
        type: 'warning',
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập email và mật khẩu.',
      });
      return;
    }

    setLoading(true);

    try {
      const user = await login(email, password);
      const from = location.state?.from?.pathname ?? ROLE_HOME[user.role] ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code ?? '';
      const message = err?.response?.data?.message || err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      addToast({ type: 'error', title: 'Đăng nhập thất bại', message });
    } finally {
      setLoading(false);
    }
  }, [email, password, navigate, location, addToast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <span className="text-2xl font-bold text-emerald-600">U</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-950">Đăng nhập UniHub</h1>
            <p className="mt-2 text-sm text-gray-500">
              Chào mừng bạn đến với hệ thống Workshop
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nguyenvana@university.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tài khoản mẫu để demo</p>
            <div className="space-y-1.5 text-xs text-gray-600">
              <DemoAccount label="Sinh viên" email="21521001@university.edu.vn" password="21521001@UniHub" />
              <DemoAccount label="Ban tổ chức" email="organizer@unihub.edu.vn" password="admin123" />
              <DemoAccount label="Nhân sự check-in" email="staff@unihub.edu.vn" password="staff123" />
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Chưa có tài khoản?{' '}
            <Link
              to="/register"
              className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoAccount({ label, email, password }) {
  const fill = (e) => {
    e.preventDefault();
    const form = e.target.closest('form');
    const emailInput = form.querySelector('#email');
    const pwInput = form.querySelector('#password');
    if (emailInput) emailInput.value = email;
    if (pwInput) pwInput.value = password;
    emailInput?.dispatchEvent(new Event('input', { bubbles: true }));
    pwInput?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <button
      onClick={fill}
      className="flex w-full items-center justify-between rounded-md px-2 py-1 hover:bg-white hover:shadow-sm"
    >
      <span className="font-medium text-gray-700">{label}</span>
      <span className="font-mono text-gray-400">{email}</span>
    </button>
  );
}

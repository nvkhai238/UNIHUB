import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../api/api';
import { ROLE_HOME } from '../../router/constants';
import { useToast } from '../../components/Toast';

const EMAIL_TAKEN_CODE = 'EMAIL_ALREADY_EXISTS';
const STUDENT_ID_TAKEN_CODE = 'STUDENT_ID_ALREADY_EXISTS';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState({ fullName: '', email: '', studentId: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const { fullName, email, studentId, password } = form;
    if (!fullName || !email || !studentId || !password) {
      addToast({
        type: 'warning',
        title: 'Thiếu thông tin',
        message: 'Vui lòng điền đầy đủ tất cả các trường.',
      });
      return;
    }
    if (password.length < 8) {
      addToast({
        type: 'warning',
        title: 'Mật khẩu yếu',
        message: 'Mật khẩu phải từ 8 ký tự trở lên.',
      });
      return;
    }

    setLoading(true);
    try {
      const user = await register(form);
      addToast({
        type: 'success',
        title: 'Đăng ký thành công!',
        message: `Chào mừng ${user.user.fullName}! Đang chuyển hướng...`,
      });
      setTimeout(() => {
        navigate(ROLE_HOME[user.user.role] ?? '/', { replace: true });
      }, 1500);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code ?? '';
      const message = err?.response?.data?.message || err?.message || 'Đăng ký thất bại. Vui lòng thử lại.';

      if (status === 409 && code === EMAIL_TAKEN_CODE) {
        addToast({
          type: 'error',
          title: 'Email đã được sử dụng',
          message: 'Email này đã có tài khoản. Vui lòng sử dụng email khác hoặc đăng nhập.',
          action: {
            label: 'Đăng nhập ngay',
            onClick: () => navigate('/login'),
          },
        });
      } else if (status === 409 && code === STUDENT_ID_TAKEN_CODE) {
        addToast({
          type: 'error',
          title: 'Mã số sinh viên đã được sử dụng',
          message: 'Mã số sinh viên này đã có tài khoản. Vui lòng đăng nhập thay vì đăng ký lại.',
          action: {
            label: 'Đăng nhập ngay',
            onClick: () => navigate('/login'),
          },
        });
      } else {
        addToast({ type: 'error', title: 'Đăng ký thất bại', message });
      }
    } finally {
      setLoading(false);
    }
  }, [form, navigate, addToast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Link
            to="/"
            className="mb-6 inline-flex items-center rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:-translate-y-0.5 hover:bg-gray-50 hover:text-emerald-700"
          >
            Trở về
          </Link>

          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <span className="text-2xl font-bold text-emerald-600">U</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-950">Đăng ký tài khoản</h1>
            <p className="mt-2 text-sm text-gray-500">
              Tạo tài khoản sinh viên để đăng ký workshop
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={form.fullName}
                onChange={handleChange('fullName')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nguyenvana@university.edu.vn"
                value={form.email}
                onChange={handleChange('email')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label htmlFor="studentId" className="mb-1.5 block text-sm font-medium text-gray-700">
                Mã số sinh viên <span className="text-red-500">*</span>
              </label>
              <input
                id="studentId"
                type="text"
                autoComplete="off"
                placeholder="21521999"
                value={form.studentId}
                onChange={handleChange('studentId')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <p className="mt-1 text-xs text-gray-400">Từ 5 đến 20 ký tự, không chứa khoảng trắng</p>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                value={form.password}
                onChange={handleChange('password')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Đã có tài khoản?{' '}
            <Link
              to="/login"
              className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

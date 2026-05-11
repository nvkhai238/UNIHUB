import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestRegistrationOtp, verifyRegistrationOtp } from '../../api/api';
import { ROLE_HOME } from '../../router/constants';
import { useToast } from '../../components/Toast';

const EMAIL_TAKEN_CODE = 'EMAIL_ALREADY_EXISTS';
const STUDENT_ID_TAKEN_CODE = 'STUDENT_ID_ALREADY_EXISTS';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({ fullName: '', email: '', studentId: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validateForm = () => {
    const { fullName, email, studentId, password } = form;
    if (!fullName || !email || !studentId || !password) {
      addToast({
        type: 'warning',
        title: 'Thiếu thông tin',
        message: 'Vui lòng điền đầy đủ tất cả các trường.',
      });
      return false;
    }
    if (password.length < 8) {
      addToast({
        type: 'warning',
        title: 'Mật khẩu yếu',
        message: 'Mật khẩu phải từ 8 ký tự trở lên.',
      });
      return false;
    }
    return true;
  };

  const requestOtp = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await requestRegistrationOtp(form);
      setChallenge(response);
      setStep('otp');
      addToast({
        type: 'success',
        title: 'Đã gửi mã OTP',
        message: `Vui lòng kiểm tra email ${response.email} để lấy mã xác thực.`,
      });
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code ?? '';
      const message = err?.response?.data?.message || err?.message || 'Không thể gửi mã OTP lúc này.';

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
        addToast({ type: 'error', title: 'Gửi OTP thất bại', message });
      }
    } finally {
      setLoading(false);
    }
  }, [form, navigate, addToast]);

  const submitOtp = useCallback(async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      addToast({
        type: 'warning',
        title: 'Thiếu mã OTP',
        message: 'Vui lòng nhập đúng mã OTP gồm 6 chữ số.',
      });
      return;
    }

    setLoading(true);
    try {
      const user = await verifyRegistrationOtp({
        email: challenge?.email ?? form.email,
        otpCode: otpCode.trim(),
      });
      addToast({
        type: 'success',
        title: 'Đăng ký thành công!',
        message: `Chào mừng ${user.user.fullName}! Đang chuyển hướng...`,
      });
      setTimeout(() => {
        navigate(ROLE_HOME[user.user.role] ?? '/', { replace: true });
      }, 1200);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Xác thực OTP thất bại.';
      addToast({ type: 'error', title: 'OTP không hợp lệ', message });
    } finally {
      setLoading(false);
    }
  }, [otpCode, challenge?.email, form.email, navigate, addToast]);

  const resendOtp = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await requestRegistrationOtp(form);
      setChallenge(response);
      addToast({
        type: 'success',
        title: 'Đã gửi lại OTP',
        message: `Mã mới đã được gửi đến ${response.email}.`,
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Không thể gửi lại OTP lúc này.';
      addToast({ type: 'error', title: 'Gửi lại OTP thất bại', message });
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-950">
              {step === 'form' ? 'Đăng ký tài khoản' : 'Xác thực email'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {step === 'form'
                ? 'Tạo tài khoản sinh viên để đăng ký workshop'
                : `Nhập mã OTP đã gửi tới ${challenge?.email ?? form.email}`}
            </p>
          </div>

          {step === 'form' ? (
            <form onSubmit={requestOtp} className="space-y-4" noValidate>
              <Field
                id="fullName"
                label="Họ và tên"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={form.fullName}
                onChange={handleChange('fullName')}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="nguyenvana@university.edu.vn"
                value={form.email}
                onChange={handleChange('email')}
              />
              <Field
                id="studentId"
                label="Mã số sinh viên"
                type="text"
                autoComplete="off"
                placeholder="21521999"
                value={form.studentId}
                onChange={handleChange('studentId')}
                helper="Từ 5 đến 20 ký tự, không chứa khoảng trắng"
              />
              <Field
                id="password"
                label="Mật khẩu"
                type="password"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                value={form.password}
                onChange={handleChange('password')}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-4" noValidate>
              <div>
                <label htmlFor="otpCode" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Mã OTP <span className="text-red-500">*</span>
                </label>
                <input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Nhập 6 chữ số"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-lg tracking-[0.4em] text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Mã có hiệu lực khoảng {Math.max(1, Math.floor((challenge?.expiresInSeconds ?? 600) / 60))} phút.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Đang xác thực...' : 'Xác thực và tạo tài khoản'}
              </button>
              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="font-semibold text-gray-500 hover:text-gray-700"
                >
                  Sửa thông tin
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  className="font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-60"
                >
                  Gửi lại OTP
                </button>
              </div>
            </form>
          )}

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

function Field({ id, label, helper, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        id={id}
        {...props}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
      />
      {helper && <p className="mt-1 text-xs text-gray-400">{helper}</p>}
    </div>
  );
}

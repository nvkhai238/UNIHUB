import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { supabase } from '../../lib/supabaseClient';


export default function PaymentStatusPage() {
  const { registrationId } = useParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [countdown, setCountdown] = useState(null); // seconds remaining
  const previousPaymentStatusRef = useRef(null);

  const PAYMENT_TIMEOUT_MINUTES = 15;

  useEffect(() => {
    loadData();
    
    // Subscribe to registration changes for real-time updates
    const channel = supabase
      .channel(`registration-${registrationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'registrations',
          filter: `id=eq.${registrationId}`,
        },
        (payload) => {
          console.log('Real-time registration update:', payload);
          // When registration updates (confirmed or cancelled), reload data
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [registrationId]);

  useEffect(() => {
    if (payment?.paymentStatus !== 'PENDING') {
      return undefined;
    }

    const poller = setInterval(() => {
      loadData({ silent: true });
    }, 3000);

    return () => clearInterval(poller);
  }, [payment?.paymentStatus, registrationId]);

  useEffect(() => {
    if (!payment?.paymentStatus) {
      return;
    }

    const previousStatus = previousPaymentStatusRef.current;
    previousPaymentStatusRef.current = payment.paymentStatus;

    if (payment.paymentStatus === 'SUCCESS' && previousStatus && previousStatus !== 'SUCCESS') {
      setMessage('Thanh toán thành công. Đang chuyển sang mã QR check-in...');
      const timer = setTimeout(() => {
        navigate(`/student/registrations/${registrationId}/qr`, { replace: true });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [payment?.paymentStatus, registrationId, navigate]);

  // Countdown timer
  useEffect(() => {
    if (!payment || payment.paymentStatus !== 'PENDING' || !payment.createdAt) {
      setCountdown(null);
      return;
    }
    const createdAt = new Date(payment.createdAt).getTime();
    const deadline = createdAt + PAYMENT_TIMEOUT_MINUTES * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        loadData(); // refresh to get FAILED status from backend
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [payment?.createdAt, payment?.paymentStatus]);

  const loadData = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const [regRes, payRes, infoRes] = await Promise.all([
        api.get(`/api/registrations/${registrationId}`),
        api.get(`/api/registrations/${registrationId}/payment-status`),
        api.get(`/api/registrations/${registrationId}/payment-info`).catch(() => ({ data: { data: null } })),
      ]);
      setRegistration(regRes.data.data);
      setPayment(payRes.data.data);
      setPaymentInfo(infoRes.data.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không tải được dữ liệu.';
      setError(msg);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setMessage('');
    try {
      const idempKey = `retry-${registrationId}-${Date.now()}`;
      await api.post(`/api/registrations/${registrationId}/payment/retry`, {}, {
        headers: { 'Idempotency-Key': idempKey },
      });
      setMessage('Đã đưa thanh toán vào hàng xử lý. Trạng thái sẽ cập nhật sau ít phút.');
      await new Promise(r => setTimeout(r, 2000));
      await loadData();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Không thể thử lại. Vui lòng liên hệ BTC.');
    } finally {
      setRetrying(false);
    }
  };

  const statusStyle = (status) => {
    const map = {
      SUCCESS: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      PENDING: 'text-amber-700 bg-amber-50 border-amber-200',
      FAILED: 'text-red-700 bg-red-50 border-red-200',
      REFUNDED: 'text-gray-700 bg-gray-50 border-gray-200',
    };
    return map[status] ?? 'text-gray-700 bg-gray-50 border-gray-200';
  };

  const statusLabel = (status) => {
    const map = {
      SUCCESS: 'Thành công',
      PENDING: 'Đang xử lý',
      FAILED: 'Thất bại',
      REFUNDED: 'Đã hoàn tiền',
    };
    return map[status] ?? status;
  };

  if (loading && !payment) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="text-sm text-gray-500">Đang tải thông tin thanh toán...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4">{error}</div>
        <Link to="/student/registrations" className="text-sm text-emerald-600 hover:underline">← Quay lại đăng ký</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link to="/student/registrations" className="text-sm text-emerald-600 hover:underline">← Quay lại đăng ký</Link>
        <h1 className="mt-2 text-3xl font-bold tracking-normal">Thông tin thanh toán</h1>
        {registration && (
          <p className="mt-1 text-sm text-gray-500">Workshop: {registration.workshopTitle || registration.workshopId}</p>
        )}
      </div>

      {message && (
        <div className={`mb-4 rounded-lg border p-4 text-sm ${message.includes('thành công') || message.includes('Đã đưa')
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
          }`}>
          {message}
        </div>
      )}

      {payment && (
        <div className="space-y-4">
          <div className={`rounded-lg border p-5 ${statusStyle(payment.paymentStatus)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">Trạng thái</p>
                <p className="mt-1 text-2xl font-bold">{statusLabel(payment.paymentStatus)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">Số tiền</p>
                <p className="mt-1 text-2xl font-bold">{formatMoney(payment.amount)}</p>
                <p className="text-xs opacity-70">{payment.currency}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-950">Chi tiết giao dịch</h2>
            <div className="space-y-3">
              <InfoRow label="Mã thanh toán" value={payment.paymentId} mono />
              <InfoRow label="Mã giao dịch cổng" value={payment.gatewayReference} mono />
              <InfoRow label="Workshop" value={payment.workshopTitle} />
              <InfoRow label="Tạo lúc" value={formatDate(payment.createdAt)} />
              <InfoRow label="Cập nhật lúc" value={formatDate(payment.updatedAt)} />
              {payment.errorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <strong>Lỗi:</strong> {payment.errorMessage}
                </div>
              )}
            </div>
          </div>

          {payment.paymentStatus === 'PENDING' && paymentInfo && (
            <div className="rounded-lg border border-amber-200 bg-white p-5">
              <h3 className="mb-4 text-center text-lg font-bold text-amber-800">Quét mã QR để thanh toán</h3>
              
              {/* Countdown timer */}
              {countdown !== null && (
                <div className={`mb-4 rounded-lg p-4 text-center ${
                  countdown <= 60
                    ? 'border border-red-300 bg-red-50'
                    : countdown <= 300
                    ? 'border border-amber-300 bg-amber-50'
                    : 'border border-blue-200 bg-blue-50'
                }`}>
                  <p className={`text-xs font-medium uppercase tracking-wide ${
                    countdown <= 60 ? 'text-red-600' : countdown <= 300 ? 'text-amber-600' : 'text-blue-600'
                  }`}>Thời gian còn lại</p>
                  <p className={`mt-1 text-3xl font-bold font-mono ${
                    countdown <= 60 ? 'text-red-700 animate-pulse' : countdown <= 300 ? 'text-amber-700' : 'text-blue-700'
                  }`}>
                    {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                  </p>
                  {countdown <= 60 && countdown > 0 && (
                    <p className="mt-1 text-xs text-red-600 font-semibold">⚠ Sắp hết thời gian thanh toán!</p>
                  )}
                  {countdown === 0 && (
                    <p className="mt-1 text-xs text-red-700 font-bold">Đã hết thời gian thanh toán. Giao dịch sẽ bị huỷ.</p>
                  )}
                </div>
              )}

              <div className="mx-auto max-w-sm rounded-lg border border-gray-100 p-4 shadow-sm">
                <img
                  src={`https://qr.sepay.vn/img?acc=${paymentInfo.accountNumber}&bank=${paymentInfo.bankName}&amount=${paymentInfo.amount}&des=${paymentInfo.paymentCode}`}
                  alt="VietQR"
                  className="w-full rounded-md"
                />
                <div className="mt-4 space-y-2 text-sm">
                  <InfoRow label="Ngân hàng" value={paymentInfo.bankName} />
                  <InfoRow label="Số tài khoản" value={paymentInfo.accountNumber} mono />
                  <InfoRow label="Tên người nhận" value={paymentInfo.accountName} />
                  <InfoRow label="Số tiền" value={formatMoney(paymentInfo.amount)} />
                  <InfoRow label="Nội dung" value={paymentInfo.paymentCode} mono />
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-gray-500">
                Hệ thống đang tự động kiểm tra trạng thái thanh toán...
              </p>
            </div>
          )}

          {payment.paymentStatus !== 'SUCCESS' && payment.paymentStatus !== 'PENDING' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h3 className="mb-2 text-sm font-semibold text-amber-800">Thử lại thanh toán</h3>
              <p className="mb-3 text-sm text-amber-700">
                Nếu giao dịch thất bại hoặc đang chờ xử lý, bạn có thể thử lại.
              </p>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {retrying ? 'Đang xử lý...' : 'Thử lại thanh toán'}
              </button>
            </div>
          )}

          {payment.paymentStatus === 'SUCCESS' && registration && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="mb-2 text-sm font-semibold text-emerald-800">Đăng ký đã xác nhận!</h3>
              <p className="mb-3 text-sm text-emerald-700">
                Bạn đã thanh toán thành công. Hãy đến workshop đúng giờ và xuất trình mã QR để check-in.
              </p>
              <Link
                to={`/student/registrations/${registrationId}/qr`}
                className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Xem mã QR check-in
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-gray-950 ${mono ? 'font-mono text-xs break-all' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function formatMoney(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

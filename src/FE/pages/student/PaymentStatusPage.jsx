import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api/api';

export default function PaymentStatusPage() {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [registrationId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [regRes, payRes] = await Promise.all([
        api.get(`/api/registrations/${registrationId}`),
        api.get(`/api/registrations/${registrationId}/payment-status`),
      ]);
      setRegistration(regRes.data.data);
      setPayment(payRes.data.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không tải được dữ liệu.';
      setError(msg);
    } finally {
      setLoading(false);
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

  if (loading) {
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

          {payment.paymentStatus !== 'SUCCESS' && (
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

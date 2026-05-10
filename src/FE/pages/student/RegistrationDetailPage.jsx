import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/api';

export default function RegistrationDetailPage() {
  const { registrationId } = useParams();
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRegistration = () => {
    setLoading(true);
    setError('');
    api.get(`/api/registrations/${registrationId}`)
      .then(({ data }) => setRegistration(data.data))
      .catch(() => setError('Không tải được chi tiết đăng ký.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRegistration();
  }, [registrationId]);

  const retryPayment = async () => {
    setMessage('');
    try {
      await api.post(`/api/registrations/${registrationId}/payment/retry`, {}, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setMessage('Đã đưa thanh toán vào hàng xử lý lại.');
      loadRegistration();
    } catch {
      setMessage('Không thể xử lý lại thanh toán lúc này.');
    }
  };

  const cancelRegistration = async () => {
    setMessage('');
    try {
      await api.delete(`/api/registrations/${registrationId}`);
      setMessage('Đăng ký đã được hủy.');
      loadRegistration();
    } catch {
      setMessage('Không thể hủy đăng ký lúc này.');
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/student/registrations" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
        Quay lại danh sách đăng ký
      </Link>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-normal text-gray-950">Chi tiết đăng ký</h1>

        {loading && <p className="mt-4 text-sm text-gray-500">Đang tải chi tiết...</p>}
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}

        {!loading && !error && registration && (
          <>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Info label="Workshop" value={registration.workshopTitle || registration.workshopId} />
              <Info label="Trạng thái" value={registrationStatusLabel(registration.status)} />
              <Info label="Đăng ký lúc" value={formatDate(registration.registeredAt)} />
              <Info label="Xác nhận lúc" value={formatDate(registration.confirmedAt) || 'Chưa xác nhận'} />
              <Info label="Registration ID" value={registration.id} />
              <Info label="Workshop ID" value={registration.workshopId} />
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              {registration.status === 'CONFIRMED' && (
                <Link
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  to={`/student/registrations/${registration.id}/qr`}
                >
                  Xem mã QR
                </Link>
              )}

              {(registration.status === 'PENDING' || registration.status === 'CANCELLED') && (
                <>
                  <button
                    type="button"
                    onClick={retryPayment}
                    className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    Xử lý lại thanh toán
                  </button>
                  <Link
                    to={`/student/registrations/${registration.id}/payment`}
                    className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Xem trạng thái thanh toán
                  </Link>
                </>
              )}
              {registration.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={cancelRegistration}
                  className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Hủy đăng ký
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 break-all text-sm font-semibold text-gray-950">{value || '-'}</dd>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function registrationStatusLabel(status) {
  const labels = {
    CONFIRMED: 'Đã xác nhận',
    PENDING: 'Đang xử lý',
    WAITLISTED: 'Danh sách chờ',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] ?? status;
}

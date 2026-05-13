import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/api';

export default function MyRegistrationsPage() {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [cancellingIds, setCancellingIds] = useState([]);
  
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const load = () => {
    setLoading(true);
    api.get(`/api/registrations/my?page=${page}&size=10`)
      .then(({ data }) => {
        setRegistrations(data.data?.content ?? []);
        setTotalPages(data.data?.totalPages ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page]);

  const retryPayment = async (id, status) => {
    if (status === 'PENDING') {
      navigate(`/student/registrations/${id}/payment`);
      return;
    }
    setNotice(null);
    try {
      await api.post(`/api/registrations/${id}/payment/retry`, {}, {
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      navigate(`/student/registrations/${id}/payment`);
    } catch (err) {
      setNotice({ type: 'error', text: err?.response?.data?.message || 'Không thể thử lại. Vui lòng liên hệ BTC.' });
    }
  };

  const cancelRegistration = async (registration) => {
    if (!canCancelRegistration(registration)) {
      setNotice({ type: 'error', text: getCancellationReason(registration) });
      return;
    }

    const id = registration.id;
    setNotice(null);
    setCancellingIds((prev) => [...prev, id]);

    try {
      const { data } = await api.delete(`/api/registrations/${id}`);
      setRegistrations((prev) => prev.map((item) => (item.id === id ? data.data : item)));
      setNotice({
        type: 'success',
        text: 'Đăng ký đã được hủy. Hệ thống sẽ tự động chuyển chỗ cho sinh viên đầu danh sách chờ nếu có.',
      });
      load();
    } catch (err) {
      setNotice({ type: 'error', text: err?.response?.data?.message || 'Không thể hủy đăng ký lúc này.' });
    } finally {
      setCancellingIds((prev) => prev.filter((item) => item !== id));
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-normal">Đăng ký của tôi</h1>
        <p className="mt-2 text-sm text-gray-600">Xem trạng thái giữ chỗ, thanh toán và mã QR check-in.</p>
      </div>

      {notice && (
        <div className={notice.type === 'error'
          ? 'mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'
          : 'mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'}
        >
          {notice.text}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Đang tải...</p>
        ) : registrations.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Bạn chưa đăng ký workshop nào.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {registrations.map((registration) => {
              const canCancel = canCancelRegistration(registration);
              const isCancelling = cancellingIds.includes(registration.id);
              const cancellationReason = getCancellationReason(registration);

              return (
                <div key={registration.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-gray-950">{registration.workshopTitle || registration.workshopId}</h2>
                      <StatusBadge status={registration.status} />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Đăng ký lúc {formatDate(registration.registeredAt)}</p>
                    {registration.workshopStartTime && <p className="text-sm text-gray-500">Workshop bắt đầu lúc {formatDate(registration.workshopStartTime)}</p>}
                    {registration.confirmedAt && <p className="text-sm text-gray-500">Xác nhận lúc {formatDate(registration.confirmedAt)}</p>}
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Link
                        className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        to={`/student/registrations/${registration.id}`}
                      >
                        Chi tiết
                      </Link>
                      {registration.status === 'CONFIRMED' && (
                        <Link className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" to={`/student/registrations/${registration.id}/qr`}>
                          Xem QR
                        </Link>
                      )}
                      {(registration.status === 'PENDING' || registration.status === 'CANCELLED') && (
                        <button
                          type="button"
                          onClick={() => retryPayment(registration.id, registration.status)}
                          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          {registration.status === 'PENDING' ? 'Thanh toán' : 'Thử lại thanh toán'}
                        </button>
                      )}
                      {registration.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          disabled={!canCancel || isCancelling}
                          title={!canCancel ? cancellationReason : undefined}
                          onClick={() => cancelRegistration(registration)}
                          className={canCancel
                            ? 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60'
                            : 'cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-500'}
                        >
                          {isCancelling ? 'Đang hủy...' : canCancel ? 'Hủy đăng ký' : 'Không thể hủy'}
                        </button>
                      )}
                    </div>
                    {!canCancel && registration.status !== 'CANCELLED' && (
                      <p className="max-w-xs text-xs text-gray-500 md:text-right">{cancellationReason}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            Trang trước
          </button>
          <span className="flex items-center px-3 text-sm text-gray-600">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            Trang sau
          </button>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    WAITLISTED: 'bg-sky-50 text-sky-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles[status] ?? styles.CANCELLED}`}>{registrationStatusLabel(status)}</span>;
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

function canCancelRegistration(registration) {
  if (registration.canCancel !== undefined && registration.canCancel !== null) {
    // If the server explicitly says it can cancel (or cannot), follow it unless status is cancelled
    if (registration.status === 'CANCELLED') return false;
  }
  if (registration.status === 'CANCELLED') return false;
  return true; // Cho phép hủy bất cứ lúc nào
}

function getCancellationReason(registration) {
  if (registration.cancellationUnavailableReason) return registration.cancellationUnavailableReason;
  if (registration.status === 'CANCELLED') return 'Đăng ký đã được hủy.';
  return '';
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

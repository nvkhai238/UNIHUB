import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../../api/api';
import PaginationControls from '../../components/PaginationControls';
import { useWorkshopRealtime } from '../../hooks/useWorkshopRealtime';
import { getCurrentUser } from '../../router/jwtUtils';
import { formatDateTime } from '../../utils/dateTime';

const PAGE_SIZE = 9;

export default function WorkshopListPage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const location = useLocation();
  const currentUser = getCurrentUser();
  const detailPrefix = location.pathname.startsWith('/student') ? '/student/workshops' : '/workshops';

  const loadWorkshops = useCallback((nextPage = page) => {
    setLoading(true);
    setError('');
    api.get('/api/workshops', { params: { page: nextPage, size: PAGE_SIZE } })
      .then(({ data }) => {
        setWorkshops(data.data?.content ?? []);
        setTotalPages(data.data?.totalPages ?? 0);
      })
      .catch((err) => setError(resolveErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page]);

  const pollWorkshops = useCallback(() => {
    api.get('/api/workshops', { params: { page, size: PAGE_SIZE } })
      .then(({ data }) => {
        setWorkshops(data.data?.content ?? []);
        setTotalPages(data.data?.totalPages ?? 0);
      })
      .catch(() => {});
  }, [page]);

  const handleListRealtimeUpdate = useCallback((payload) => {
    if (!payload?.new) return;

    setWorkshops((prev) => {
      const index = prev.findIndex((item) => item.id === payload.new.id);
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...payload.new };
      return next;
    });
  }, []);

  const { realtimeAvailable } = useWorkshopRealtime({ onListUpdate: handleListRealtimeUpdate });

  useEffect(() => {
    loadWorkshops(page);
  }, [page, loadWorkshops]);

  useEffect(() => {
    const interval = setInterval(pollWorkshops, 10000);
    return () => clearInterval(interval);
  }, [pollWorkshops]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-gray-950">Lich workshop</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Chon workshop, xem so ghe con lai theo thoi gian thuc va dang ky bang tai khoan sinh vien.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            {realtimeAvailable
              ? 'Realtime seats dang ket noi.'
              : 'Realtime tam thoi gian doan. He thong dang fallback sang polling 10s.'}
          </p>
        </div>
        {currentUser?.role === 'STUDENT' && (
          <Link to="/student/registrations" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            Dang ky cua toi
          </Link>
        )}
      </div>

      {loading && <StateBox text="Dang tai workshop..." />}
      {error && <StateBox text={error} tone="error" onRetry={() => loadWorkshops(page)} />}

      {!loading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workshops.map((workshop) => (
              <Link
                key={workshop.id}
                to={`${detailPrefix}/${workshop.id}`}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 text-lg font-semibold text-gray-950">{workshop.title}</h2>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    {workshop.remainingSeats}/{workshop.capacity}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Thoi gian:</strong> {formatDate(workshop.startTime)}</p>
                  <p><strong>Phong:</strong> {workshop.room}</p>
                  <p><strong>Dien gia:</strong> {workshop.speakerName || 'Dang cap nhat'}</p>
                  <p className="mt-1 font-semibold text-gray-950">{formatPrice(workshop.price)}</p>
                </div>
              </Link>
            ))}
          </div>

          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

function StateBox({ text, tone = 'default', onRetry }) {
  return (
    <div className={['rounded-lg border p-4 text-sm', tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'].join(' ')}>
      <p>{text}</p>
      {tone === 'error' && typeof onRetry === 'function' && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Thu lai
        </button>
      )}
    </div>
  );
}

function formatDate(value) {
  return formatDateTime(value, 'Chua co lich');
}

function formatPrice(value) {
  const amount = Number(value ?? 0);
  return amount === 0 ? 'Mien phi' : `${amount.toLocaleString('vi-VN')}d`;
}

function resolveErrorMessage(err) {
  const serverMessage = err?.response?.data?.message;
  if (serverMessage) return `Khong tai duoc danh sach workshop: ${serverMessage}`;
  if (err?.code === 'ECONNABORTED') return 'Khong tai duoc danh sach workshop: qua thoi gian cho ket noi BE.';
  return 'Khong tai duoc danh sach workshop. Kiem tra BE da chay va dung cau hinh CORS/base URL.';
}

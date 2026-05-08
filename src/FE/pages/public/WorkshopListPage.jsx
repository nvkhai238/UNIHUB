import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';

export default function WorkshopListPage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkshops = () => {
    setLoading(true);
    setError('');
    api.get('/api/workshops?size=24')
      .then(({ data }) => {
        setWorkshops(data.data?.content ?? []);
      })
      .catch((err) => {
        setError(resolveErrorMessage(err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWorkshops();
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-gray-950">Lịch workshop</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Chọn workshop, xem số ghế còn lại theo thời gian thực và đăng ký bằng tài khoản sinh viên.
          </p>
        </div>
        <Link to="/student/registrations" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          Đăng ký của tôi
        </Link>
      </div>

      {loading && <StateBox text="Đang tải workshop..." />}
      {error && <StateBox text={error} tone="error" onRetry={loadWorkshops} />}

      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workshops.map((workshop) => (
            <Link
              key={workshop.id}
              to={`/workshops/${workshop.id}`}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="line-clamp-2 text-lg font-semibold text-gray-950">{workshop.title}</h2>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {workshop.remainingSeats}/{workshop.capacity}
                </span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>{formatDate(workshop.startTime)}</p>
                <p>{workshop.room}</p>
                <p className="font-semibold text-gray-950">{formatPrice(workshop.price)}</p>
              </div>
            </Link>
          ))}
        </div>
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
          Thử lại
        </button>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'Chưa có lịch';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPrice(value) {
  const amount = Number(value ?? 0);
  return amount === 0 ? 'Miễn phí' : `${amount.toLocaleString('vi-VN')}đ`;
}

function resolveErrorMessage(err) {
  const serverMessage = err?.response?.data?.message;
  if (serverMessage) return `Không tải được danh sách workshop: ${serverMessage}`;
  if (err?.code === 'ECONNABORTED') return 'Không tải được danh sách workshop: quá thời gian chờ kết nối BE.';
  return 'Không tải được danh sách workshop. Kiểm tra BE đã chạy và đúng cấu hình CORS/base URL.';
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';

export default function WorkshopManagePage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/api/workshops/admin?size=50')
      .then(({ data }) => setWorkshops(data.data?.content ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const publish = async (id) => {
    await api.patch(`/api/workshops/${id}/status`, { status: 'PUBLISHED' });
    setMessage('Workshop đã được xuất bản.');
    load();
  };

  const cancel = async (id) => {
    await api.post(`/api/workshops/${id}/cancel`);
    setMessage('Workshop đã hủy, các thanh toán liên quan được đánh dấu hoàn tiền và email sẽ được gửi bất đồng bộ.');
    load();
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Quản lý Workshop</h1>
          <p className="mt-2 text-sm text-gray-600">Theo dõi trạng thái, ghế còn lại và thao tác xuất bản/hủy.</p>
        </div>
        <Link to="/admin/workshops/create" className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
          Tạo workshop
        </Link>
      </div>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Đang tải...</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {workshops.map((workshop) => (
              <div key={workshop.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-950">{workshop.title}</h2>
                    <StatusBadge status={workshop.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{formatDate(workshop.startTime)} · {workshop.room}</p>
                  <p className="mt-1 text-sm text-gray-500">Ghế còn lại {workshop.remainingSeats}/{workshop.capacity}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" to={`/admin/workshops/${workshop.id}/edit`}>
                    Sửa
                  </Link>
                  {workshop.status === 'DRAFT' && (
                    <button type="button" onClick={() => publish(workshop.id)} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                      Xuất bản
                    </button>
                  )}
                  {workshop.status !== 'CANCELLED' && (
                    <button type="button" onClick={() => cancel(workshop.id)} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
                      Hủy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PUBLISHED: 'bg-emerald-50 text-emerald-700',
    DRAFT: 'bg-amber-50 text-amber-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles[status] ?? styles.DRAFT}`}>{workshopStatusLabel(status)}</span>;
}

function workshopStatusLabel(status) {
  const labels = {
    DRAFT: 'Nháp',
    PUBLISHED: 'Đã xuất bản',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] ?? status;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

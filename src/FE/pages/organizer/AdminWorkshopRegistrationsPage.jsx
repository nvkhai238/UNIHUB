import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/api';
import PaginationControls from '../../components/PaginationControls';
import { formatDateTime } from '../../utils/dateTime';

export default function AdminWorkshopRegistrationsPage() {
  const { id } = useParams();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workshop, setWorkshop] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = () => {
    setLoading(true);

    if (!workshop) {
      api.get(`/api/workshops/${id}`)
        .then(({ data }) => setWorkshop(data.data))
        .catch(() => {});
    }

    const params = new URLSearchParams({ page: String(page), size: '20' });
    if (statusFilter) {
      params.append('status', statusFilter);
    }

    api.get(`/api/workshops/${id}/registrations?${params.toString()}`)
      .then(({ data }) => {
        setRegistrations(data.data?.content ?? []);
        setTotalPages(data.data?.totalPages ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [id, page, statusFilter]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Link to="/admin/workshops" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              ← Quay lại
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-normal">
            Danh sách vé {workshop ? `- ${workshop.title}` : ''}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Xem danh sách sinh viên đã đăng ký và lọc theo trạng thái.
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(0);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="PENDING">Đang chờ</option>
            <option value="WAITLISTED">Danh sách chờ</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading && registrations.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Đang tải dữ liệu...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-900">
                <tr>
                  <th className="px-5 py-3 font-semibold">Sinh viên</th>
                  <th className="px-5 py-3 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3 font-semibold">Mã vé (QR Code)</th>
                  <th className="px-5 py-3 font-semibold">Thời gian đăng ký</th>
                  <th className="px-5 py-3 font-semibold">Thời gian xác nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registrations.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-gray-500">
                      Không có vé nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  registrations.map((registration) => (
                    <tr key={registration.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {registration.studentName || 'Chưa cập nhật'}
                        {registration.studentCode && <div className="text-sm font-normal text-gray-500">{registration.studentCode}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={registration.status} />
                      </td>
                      <td className="w-64 break-all px-5 py-4 font-mono text-xs text-gray-500">{registration.qrCode}</td>
                      <td className="px-5 py-4">{formatDate(registration.registeredAt)}</td>
                      <td className="px-5 py-4">{formatDate(registration.confirmedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
    </section>
  );
}

function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
    WAITLISTED: 'bg-sky-50 text-sky-700 border border-sky-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border border-gray-200',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? styles.CANCELLED}`}>
      {registrationStatusLabel(status)}
    </span>
  );
}

function registrationStatusLabel(status) {
  const labels = {
    CONFIRMED: 'Đã xác nhận',
    PENDING: 'Đang xử lý',
    WAITLISTED: 'Chờ',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] ?? status;
}

function formatDate(value) {
  return formatDateTime(value, '-');
}

import { useEffect, useState } from 'react';
import api from '../../api/api';

const DEFAULT_FILTERS = {
  workshopId: '',
  workshopStatus: '',
  paymentStatus: '',
  from: '',
  to: '',
};

export default function StatisticsPage() {
  const [stats, setStats] = useState(null);
  const [paymentStats, setPaymentStats] = useState(null);
  const [imports, setImports] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [importRunning, setImportRunning] = useState(false);

  const load = async (nextFilters = filters) => {
    setLoading(true);
    setLoadError('');
    try {
      const workshopParams = buildWorkshopStatParams(nextFilters);
      const paymentParams = buildPaymentStatParams(nextFilters);
      const [statsRes, paymentRes, importRes, workshopRes] = await Promise.allSettled([
        api.get('/api/workshops/statistics', { params: workshopParams }),
        api.get('/api/admin/payments/stats', { params: paymentParams }),
        api.get('/api/admin/student-imports'),
        api.get('/api/workshops/admin', { params: { size: 100 } }),
      ]);

      const errors = [];
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data.data);
      } else {
        setStats(null);
        errors.push('Không tải được thống kê workshop.');
      }

      if (paymentRes.status === 'fulfilled') {
        setPaymentStats(paymentRes.value.data.data);
      } else {
        setPaymentStats(null);
        errors.push('Không tải được thống kê payment.');
      }

      if (importRes.status === 'fulfilled') {
        setImports(importRes.value.data.data ?? []);
      } else {
        setImports([]);
        errors.push('Không tải được lịch sử import CSV.');
      }

      if (workshopRes.status === 'fulfilled') {
        setWorkshops(workshopRes.value.data.data?.content ?? []);
      } else {
        setWorkshops([]);
        errors.push('Không tải được danh sách workshop cho filter.');
      }

      setLoadError(errors.join(' '));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(DEFAULT_FILTERS);
  }, []);

  const runImport = async () => {
    setImportRunning(true);
    setMessage('');
    try {
      const { data } = await api.post('/api/admin/student-imports/run');
      const batch = data.data ?? {};
      setMessage(`Import CSV ${batchStatusLabel(batch.status).toLowerCase()}: ${batch.successRows ?? 0} dòng hợp lệ, ${batch.errorRows ?? 0} dòng lỗi.`);
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Không chạy được import CSV.');
    } finally {
      setImportRunning(false);
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    load(filters);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    load(DEFAULT_FILTERS);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Thống kê và đồng bộ</h1>
          <p className="mt-2 text-sm text-gray-600">Báo cáo đăng ký, check-in, doanh thu và batch CSV sinh viên.</p>
        </div>
        <button
          type="button"
          onClick={runImport}
          disabled={importRunning}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importRunning ? 'Đang import...' : 'Chạy import CSV'}
        </button>
      </div>

      <form onSubmit={applyFilters} className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.workshopId} onChange={(event) => setFilters((prev) => ({ ...prev, workshopId: event.target.value }))}>
          <option value="">Tất cả workshop</option>
          {workshops.map((workshop) => (
            <option key={workshop.id} value={workshop.id}>{workshop.title}</option>
          ))}
        </select>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.workshopStatus} onChange={(event) => setFilters((prev) => ({ ...prev, workshopStatus: event.target.value }))}>
          <option value="">Tất cả trạng thái workshop</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="PUBLISHED">Đã xuất bản</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.paymentStatus} onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}>
          <option value="">Tất cả trạng thái thanh toán</option>
          <option value="PENDING">Đang chờ</option>
          <option value="SUCCESS">Thành công</option>
          <option value="FAILED">Thất bại</option>
          <option value="REFUNDED">Đã hoàn tiền</option>
        </select>
        <input type="datetime-local" className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} />
        <input type="datetime-local" className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Áp dụng filter</button>
        <button type="button" onClick={resetFilters} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Đặt lại</button>
      </form>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
      {loadError && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{loadError}</div>}
      {loading && <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">Đang tải thống kê...</p>}

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Workshop" value={stats.totalWorkshops} />
            <Metric label="Đăng ký" value={stats.totalRegistrations} />
            <Metric label="Check-in" value={stats.totalCheckins} />
            <Metric label="Doanh thu" value={formatMoney(stats.totalRevenue)} />
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-semibold">Thống kê theo workshop</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Workshop</th>
                    <th className="px-4 py-3">Tổng ĐK</th>
                    <th className="px-4 py-3">Đã xác nhận</th>
                    <th className="px-4 py-3">Chờ</th>
                    <th className="px-4 py-3">Đang xử lý</th>
                    <th className="px-4 py-3">Đã hủy</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3">Tỷ lệ</th>
                    <th className="px-4 py-3">Còn chỗ</th>
                    <th className="px-4 py-3">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(stats.breakdown ?? []).length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan={10}>Không có workshop phù hợp với filter hiện tại.</td>
                    </tr>
                  )}
                  {(stats.breakdown ?? []).map((row) => (
                    <tr key={row.workshopId}>
                      <td className="px-4 py-3 font-medium text-gray-950">{row.workshopTitle}</td>
                      <td className="px-4 py-3">{row.registrationsCount}</td>
                      <td className="px-4 py-3">{row.confirmedCount}</td>
                      <td className="px-4 py-3">{row.waitlistedCount}</td>
                      <td className="px-4 py-3">{row.pendingCount}</td>
                      <td className="px-4 py-3">{row.cancelledCount}</td>
                      <td className="px-4 py-3">{row.checkinCount}</td>
                      <td className="px-4 py-3">{Math.round((row.checkinRate ?? 0) * 100)}%</td>
                      <td className="px-4 py-3">{row.remainingSeats}/{row.capacity}</td>
                      <td className="px-4 py-3">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {paymentStats && (
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Tổng thanh toán" value={paymentStats.totalPayments} />
          <Metric label="Thành công" value={paymentStats.byStatus?.SUCCESS?.count ?? 0} />
          <Metric label="Tỷ lệ thành công" value={paymentStats.successRate} />
          <Metric label="Trung bình / giao dịch" value={formatMoney(paymentStats.averageAmount)} />
        </div>
      )}

      {paymentStats && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold">Phân bổ thanh toán</h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">Theo trạng thái</h3>
              <div className="mt-3 space-y-2 text-sm">
                {Object.entries(paymentStats.byStatus ?? {}).map(([status, bucket]) => (
                  <div key={status} className="flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-700">{paymentStatusLabel(status)}</span>
                    <span className="text-right text-gray-950">{bucket.count} giao dịch - {formatMoney(bucket.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">Top workshop doanh thu</h3>
              <div className="mt-3 space-y-2 text-sm">
                {(paymentStats.topWorkshops ?? []).length === 0 && (
                  <p className="text-sm text-gray-500">Chưa có thanh toán phù hợp với filter hiện tại.</p>
                )}
                {(paymentStats.topWorkshops ?? []).map((item) => (
                  <div key={item.workshopId} className="flex items-center justify-between gap-3">
                    <span className="line-clamp-1">{item.title}</span>
                    <span>{formatMoney(item.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Batch CSV sinh viên</h2>
        <div className="mt-4 divide-y divide-gray-100">
          {imports.length === 0 ? (
            <p className="text-sm text-gray-500">Chưa có batch import nào.</p>
          ) : imports.slice(0, 8).map((batch) => (
            <div key={batch.id} className="grid gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-medium text-gray-950">{batch.fileName}</p>
                <p className="text-sm text-gray-500">
                  {formatDate(batch.startedAt)} | Tổng {batch.totalRows ?? 0} | {batch.successRows ?? 0} hợp lệ | {batch.errorRows ?? 0} lỗi
                </p>
                {batch.errorLog && <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap rounded-md bg-rose-50 p-2 text-xs text-rose-700">{String(batch.errorLog)}</pre>}
              </div>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${batchStatusStyle(batch.status)}`}>{batchStatusLabel(batch.status)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function buildWorkshopStatParams(filters) {
  const params = {};
  if (filters.workshopId) params.workshopId = filters.workshopId;
  if (filters.workshopStatus) params.status = filters.workshopStatus;
  if (filters.from) params.from = toIso(filters.from);
  if (filters.to) params.to = toIso(filters.to);
  return params;
}

function buildPaymentStatParams(filters) {
  const params = {};
  if (filters.workshopId) params.workshopId = filters.workshopId;
  if (filters.paymentStatus) params.status = filters.paymentStatus;
  if (filters.from) params.from = toIso(filters.from);
  if (filters.to) params.to = toIso(filters.to);
  return params;
}

function toIso(value) {
  return new Date(value).toISOString();
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString('vi-VN')} đ`;
}

function paymentStatusLabel(status) {
  const labels = {
    PENDING: 'Đang chờ',
    SUCCESS: 'Thành công',
    FAILED: 'Thất bại',
    REFUNDED: 'Đã hoàn tiền',
  };
  return labels[status] ?? status;
}

function batchStatusLabel(status) {
  const labels = {
    COMPLETED: 'Hoàn tất',
    FAILED: 'Thất bại',
    RUNNING: 'Đang chạy',
    SKIPPED: 'Đã bỏ qua',
  };
  return labels[status] ?? status;
}

function batchStatusStyle(status) {
  const styles = {
    COMPLETED: 'bg-emerald-50 text-emerald-700',
    FAILED: 'bg-red-50 text-red-700',
    RUNNING: 'bg-blue-50 text-blue-700',
    SKIPPED: 'bg-gray-100 text-gray-700',
  };
  return styles[status] ?? 'bg-gray-100 text-gray-700';
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

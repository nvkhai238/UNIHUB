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

  const load = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const workshopParams = buildWorkshopStatParams(nextFilters);
      const paymentParams = buildPaymentStatParams(nextFilters);
      const [statsRes, paymentRes, importRes, workshopRes] = await Promise.all([
        api.get('/api/workshops/statistics', { params: workshopParams }),
        api.get('/api/admin/payments/stats', { params: paymentParams }),
        api.get('/api/admin/student-imports').catch(() => ({ data: { data: [] } })),
        api.get('/api/workshops/admin', { params: { size: 100 } }).catch(() => ({ data: { data: { content: [] } } })),
      ]);
      setStats(statsRes.data.data);
      setPaymentStats(paymentRes.data.data);
      setImports(importRes.data.data ?? []);
      setWorkshops(workshopRes.data.data?.content ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(DEFAULT_FILTERS);
  }, []);

  const runImport = async () => {
    setMessage('');
    const { data } = await api.post('/api/admin/student-imports/run');
    setMessage(`Import CSV hoan tat: ${data.data?.successRows ?? 0} dong hop le, ${data.data?.errorRows ?? 0} dong loi.`);
    load();
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
          <h1 className="text-3xl font-bold tracking-normal">Thong ke va dong bo</h1>
          <p className="mt-2 text-sm text-gray-600">Bao cao dang ky, check-in, doanh thu va batch CSV sinh vien.</p>
        </div>
        <button type="button" onClick={runImport} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
          Chay import CSV
        </button>
      </div>

      <form onSubmit={applyFilters} className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.workshopId} onChange={(event) => setFilters((prev) => ({ ...prev, workshopId: event.target.value }))}>
          <option value="">Tat ca workshop</option>
          {workshops.map((workshop) => (
            <option key={workshop.id} value={workshop.id}>{workshop.title}</option>
          ))}
        </select>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.workshopStatus} onChange={(event) => setFilters((prev) => ({ ...prev, workshopStatus: event.target.value }))}>
          <option value="">Tat ca trang thai workshop</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.paymentStatus} onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}>
          <option value="">Tat ca trang thai payment</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <input type="datetime-local" className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} />
        <input type="datetime-local" className="rounded-md border border-gray-300 px-3 py-2 text-sm" value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Ap dung filter</button>
        <button type="button" onClick={resetFilters} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Dat lai</button>
      </form>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
      {loading && <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">Dang tai thong ke...</p>}

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Workshop" value={stats.totalWorkshops} />
            <Metric label="Dang ky" value={stats.totalRegistrations} />
            <Metric label="Check-in" value={stats.totalCheckins} />
            <Metric label="Doanh thu" value={formatMoney(stats.totalRevenue)} />
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-semibold">Thong ke theo workshop</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Workshop</th>
                    <th className="px-4 py-3">Tong DK</th>
                    <th className="px-4 py-3">Da xac nhan</th>
                    <th className="px-4 py-3">Cho</th>
                    <th className="px-4 py-3">Dang xu ly</th>
                    <th className="px-4 py-3">Da huy</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3">Ty le</th>
                    <th className="px-4 py-3">Con cho</th>
                    <th className="px-4 py-3">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
          <Metric label="Payment tong" value={paymentStats.totalPayments} />
          <Metric label="Thanh cong" value={paymentStats.byStatus?.SUCCESS?.count ?? 0} />
          <Metric label="Ty le thanh cong" value={paymentStats.successRate} />
          <Metric label="TB / giao dich" value={formatMoney(paymentStats.averageAmount)} />
        </div>
      )}

      {paymentStats && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold">Phan bo payment</h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">Theo trang thai</h3>
              <div className="mt-3 space-y-2 text-sm">
                {Object.entries(paymentStats.byStatus ?? {}).map(([status, bucket]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span>{status}</span>
                    <span>{bucket.count} | {formatMoney(bucket.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">Top workshop doanh thu</h3>
              <div className="mt-3 space-y-2 text-sm">
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
        <h2 className="text-lg font-semibold">Batch CSV sinh vien</h2>
        <div className="mt-4 divide-y divide-gray-100">
          {imports.length === 0 ? (
            <p className="text-sm text-gray-500">Chua co batch import nao.</p>
          ) : imports.slice(0, 8).map((batch) => (
            <div key={batch.id} className="grid gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-medium text-gray-950">{batch.fileName}</p>
                <p className="text-sm text-gray-500">{formatDate(batch.startedAt)} | {batch.successRows ?? 0} OK | {batch.errorRows ?? 0} loi</p>
                {batch.errorLog && <p className="mt-1 text-xs text-rose-600">{String(batch.errorLog).slice(0, 220)}</p>}
              </div>
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{batchStatusLabel(batch.status)}</span>
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
  return amount === 0 ? '0d' : `${amount.toLocaleString('vi-VN')}d`;
}

function batchStatusLabel(status) {
  const labels = {
    COMPLETED: 'Hoan tat',
    FAILED: 'That bai',
    RUNNING: 'Dang chay',
    SKIPPED: 'Da bo qua',
  };
  return labels[status] ?? status;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

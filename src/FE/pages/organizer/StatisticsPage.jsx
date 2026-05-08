import { useEffect, useState } from 'react';
import api from '../../api/api';

export default function StatisticsPage() {
  const [stats, setStats] = useState(null);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/workshops/statistics'),
      api.get('/api/admin/student-imports').catch(() => ({ data: { data: [] } })),
    ])
      .then(([statsRes, importRes]) => {
        setStats(statsRes.data.data);
        setImports(importRes.data.data ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const runImport = async () => {
    setMessage('');
    const { data } = await api.post('/api/admin/student-imports/run');
    setMessage(`Import CSV hoàn tất: ${data.data?.successRows ?? 0} dòng hợp lệ, ${data.data?.errorRows ?? 0} dòng lỗi.`);
    load();
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Thống kê & đồng bộ</h1>
          <p className="mt-2 text-sm text-gray-600">Báo cáo đăng ký, check-in, doanh thu và batch CSV sinh viên.</p>
        </div>
        <button type="button" onClick={runImport} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
          Chạy import CSV
        </button>
      </div>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}
      {loading && <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">Đang tải thống kê...</p>}

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Workshop" value={stats.totalWorkshops} />
            <Metric label="Registration" value={stats.totalRegistrations} />
            <Metric label="Check-in" value={stats.totalCheckins} />
            <Metric label="Doanh thu" value={formatMoney(stats.totalRevenue)} />
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-semibold">Theo từng workshop</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Workshop</th>
                    <th className="px-4 py-3">Confirmed</th>
                    <th className="px-4 py-3">Waitlist</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3">Tỷ lệ</th>
                    <th className="px-4 py-3">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(stats.breakdown ?? []).map((row) => (
                    <tr key={row.workshopId}>
                      <td className="px-4 py-3 font-medium text-gray-950">{row.workshopTitle}</td>
                      <td className="px-4 py-3">{row.confirmedCount}</td>
                      <td className="px-4 py-3">{row.waitlistedCount}</td>
                      <td className="px-4 py-3">{row.pendingCount}</td>
                      <td className="px-4 py-3">{row.checkinCount}</td>
                      <td className="px-4 py-3">{Math.round((row.checkinRate ?? 0) * 100)}%</td>
                      <td className="px-4 py-3">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
                <p className="text-sm text-gray-500">{formatDate(batch.startedAt)} · {batch.successRows ?? 0} OK · {batch.errorRows ?? 0} lỗi</p>
              </div>
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{batch.status}</span>
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

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return amount === 0 ? '0đ' : `${amount.toLocaleString('vi-VN')}đ`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

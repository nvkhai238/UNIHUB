import { useEffect, useState } from 'react';
import api from '../../api/api';
import { formatDateTime } from '../../utils/dateTime';

export default function StudentImportPage() {
  const [batches, setBatches] = useState([]);
  const [latestStatus, setLatestStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchRes, statusRes] = await Promise.allSettled([
        api.get('/api/admin/student-imports'),
        api.get('/api/csv/status'),
      ]);
      if (batchRes.status === 'fulfilled') {
        setBatches(batchRes.value.data.data ?? []);
      }
      if (statusRes.status === 'fulfilled') {
        setLatestStatus(statusRes.value.data.data ?? null);
      }
      if (batchRes.status === 'rejected' || statusRes.status === 'rejected') {
        setMessage('Không tải đủ dữ liệu import CSV.');
        setMessageType('error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const runImport = async () => {
    setRunning(true);
    setMessage('');
    try {
      const { data } = await api.post('/api/admin/student-imports/run', {}, {
        headers: { 'Idempotency-Key': `import-${Date.now()}` },
      });
      const batch = data.data ?? {};
      setMessage(`Import CSV ${batchStatusLabel(batch.status).toLowerCase()}: ${batch.successRows ?? 0} dòng hợp lệ, ${batch.errorRows ?? 0} dòng lỗi.`);
      setMessageType(batch.status === 'COMPLETED' ? 'success' : 'warning');
      await loadData();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Import thất bại. Vui lòng kiểm tra batch log.');
      setMessageType('error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Nhập CSV sinh viên</h1>
          <p className="mt-2 text-sm text-gray-600">
            Job tự động chạy lúc 02:00 hằng ngày với file <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/data/students_YYYY-MM-DD.csv</code>.
            File mẫu dùng định dạng <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">student_id,full_name,email</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runImport}
            disabled={running}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? 'Đang chạy...' : 'Chạy import ngay'}
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Làm mới
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg border p-4 text-sm ${messageStyle(messageType)}`}>
          {message}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatusMetric label="Trạng thái mới nhất" value={batchStatusLabel(latestStatus?.status ?? 'NOT_STARTED')} />
        <StatusMetric label="Đã xử lý" value={latestStatus?.processedRecords ?? 0} />
        <StatusMetric label="Dòng lỗi" value={latestStatus?.failedRecords ?? 0} />
        <StatusMetric label="Batch ID" value={formatJobId(latestStatus?.jobId)} />
      </div>

      {loading ? (
        <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">Đang tải lịch sử import...</p>
      ) : batches.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">Chưa có lần import nào được ghi nhận.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Lần chạy</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Tổng dòng</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Hợp lệ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Lỗi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Thời gian</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Chi tiết lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map((batch) => (
                <tr key={batch.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{formatJobId(batch.id)}</td>
                  <td className="px-4 py-3 text-gray-950">{batch.fileName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${batchStatusStyle(batch.status)}`}>
                      {batchStatusLabel(batch.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{batch.totalRows ?? 0}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{batch.successRows ?? 0}</td>
                  <td className={`px-4 py-3 font-semibold ${(batch.errorRows ?? 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {batch.errorRows ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <div>{formatDate(batch.startedAt)}</div>
                    <div>{formatDate(batch.completedAt)}</div>
                  </td>
                  <td className="max-w-sm px-4 py-3 text-xs text-gray-500">
                    {batch.errorLog ? (
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs text-gray-700">{batch.errorLog}</pre>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 truncate text-xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function messageStyle(type) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
  };
  return styles[type] ?? 'border-gray-200 bg-white text-gray-700';
}

function batchStatusStyle(status) {
  const styles = {
    COMPLETED: 'bg-emerald-50 text-emerald-700',
    FAILED: 'bg-red-50 text-red-700',
    RUNNING: 'bg-blue-50 text-blue-700',
    SKIPPED: 'bg-gray-100 text-gray-700',
    NOT_STARTED: 'bg-gray-100 text-gray-700',
  };
  return styles[status] ?? 'bg-gray-100 text-gray-700';
}

function batchStatusLabel(status) {
  const labels = {
    COMPLETED: 'Hoàn tất',
    FAILED: 'Thất bại',
    RUNNING: 'Đang chạy',
    SKIPPED: 'Đã bỏ qua',
    NOT_STARTED: 'Chưa chạy',
  };
  return labels[status] ?? status;
}

function formatDate(value) {
  return formatDateTime(value, '—');
}

function formatJobId(value) {
  if (!value) return '—';
  return String(value).length > 8 ? `${String(value).slice(0, 8)}...` : value;
}

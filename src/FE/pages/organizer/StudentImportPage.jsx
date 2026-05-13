import { useEffect, useState } from 'react';
import api from '../../api/api';

export default function StudentImportPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  const loadBatches = () => {
    setLoading(true);
    api.get('/api/admin/student-imports')
      .then(({ data }) => setBatches(data.data ?? []))
      .catch(() => setMessage('Không tải được lịch sử import.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBatches(); }, []);

  const runImport = async () => {
    setRunning(true);
    setMessage('');
    try {
      const idempKey = `import-${Date.now()}`;
      const { data } = await api.post('/api/admin/student-imports/run', {}, {
        headers: { 'Idempotency-Key': idempKey },
      });
      setMessage(`Import hoàn tất: ${data.data?.successRows ?? 0} dòng thành công.`);
      setMessageType('success');
      loadBatches();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Import thất bại. Vui lòng kiểm tra log.';
      setMessage(msg);
      setMessageType('error');
    } finally {
      setRunning(false);
    }
  };

  const statusStyle = (status) => {
    const map = {
      COMPLETED: 'bg-emerald-50 text-emerald-700',
      FAILED: 'bg-red-50 text-red-700',
      RUNNING: 'bg-blue-50 text-blue-700',
      SKIPPED: 'bg-gray-50 text-gray-600',
    };
    return map[status] ?? 'bg-gray-50 text-gray-600';
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-normal">Nhập CSV sinh viên</h1>
        <p className="mt-2 text-sm text-gray-600">
          Chạy job để đồng bộ danh sách sinh viên từ hệ thống cũ (Spring Batch, 2:00 AM hàng ngày).
          File CSV: <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/data/students_YYYY-MM-DD.csv</code>
          — Định dạng: <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">student_id,full_name,email</code>
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={runImport}
          disabled={running}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {running ? 'Đang chạy...' : '▶ Chạy import ngay'}
        </button>
        <button
          onClick={loadBatches}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          🔄 Làm mới
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg border p-4 text-sm ${
          messageType === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {message}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        <strong>⚠️ Lưu ý:</strong> Job tự động chạy lúc 2:00 AM mỗi ngày. Chạy thủ công chỉ dùng để kiểm tra hoặc khắc phục sự cố.
        Dữ liệu hiện có của sinh viên (vai trò, đăng ký) không bị ảnh hưởng — chỉ cập nhật họ tên và email.
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Đang tải...</p>
      ) : batches.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <div className="mb-2 text-3xl">📋</div>
          <p className="text-sm text-gray-500">Chưa có lần import nào được ghi nhận.</p>
          <p className="mt-1 text-xs text-gray-400">Job chạy tự động lúc 2:00 AM hoặc bấm "Chạy import ngay".</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lần chạy</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Thành công</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lỗi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Chi tiết</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bắt đầu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hoàn tất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{batch.id?.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{batch.fileName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusStyle(batch.status)}`}>
                      {batchStatusLabel(batch.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{batch.successRows ?? 0}</td>
                  <td className={`px-4 py-3 font-semibold ${(batch.errorRows ?? 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {batch.errorRows ?? 0}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-gray-500">
                    <span className="line-clamp-3">{batch.errorLog || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(batch.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(batch.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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

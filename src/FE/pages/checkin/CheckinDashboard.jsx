import { useEffect, useState } from 'react';
import api from '../../api/api';

const DEVICE_ID_KEY = 'unihub_checkin_device_id';

export default function CheckinDashboard() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preload, setPreload] = useState([]);
  const [qrLines, setQrLines] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const cached = localStorage.getItem(`checkin_preload_${date}`);
    setPreload(cached ? JSON.parse(cached) : []);
  }, [date]);

  const loadPreload = async () => {
    setMessage('');
    const { data } = await api.get(`/api/checkins/preload?date=${date}`);
    const rows = data.data ?? [];
    localStorage.setItem(`checkin_preload_${date}`, JSON.stringify(rows));
    setPreload(rows);
    setMessage(`Đã preload ${rows.length} mã QR hợp lệ cho ngày ${date}.`);
  };

  const sync = async () => {
    const records = qrLines
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((qrCode) => ({
        qrCode,
        timestamp: new Date().toISOString(),
        deviceId: getDeviceId(),
      }));

    const { data } = await api.post('/api/checkins/sync', records);
    setSyncResult(data.data);
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-normal">Preload & đồng bộ check-in</h1>
        <p className="mt-2 text-sm text-gray-600">Tải danh sách QR hợp lệ trước sự kiện và đồng bộ pending scans khi có mạng.</p>
      </div>

      {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Preload QR</h2>
          <div className="mt-4 flex gap-2">
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button type="button" onClick={loadPreload} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
              Tải
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-600">Đang lưu local: <span className="font-semibold text-gray-950">{preload.length}</span> QR</p>
          <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-gray-100">
            {preload.slice(0, 20).map((row) => (
              <div key={`${row.workshopId}-${row.qrCode}`} className="border-b border-gray-100 px-3 py-2 text-sm last:border-0">
                <p className="font-medium text-gray-950">{row.fullName}</p>
                <p className="break-all text-xs text-gray-500">{row.qrCode}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Sync pending scans</h2>
          <textarea
            value={qrLines}
            onChange={(event) => setQrLines(event.target.value)}
            rows={8}
            placeholder="Dán mỗi QR một dòng để mô phỏng pending queue từ thiết bị offline"
            className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="button" onClick={sync} className="mt-3 rounded-md bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
            Đồng bộ
          </button>
          {syncResult && (
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm">
              <p className="font-semibold text-gray-950">
                {syncResult.created} mới · {syncResult.duplicate} trùng · {syncResult.conflict} xung đột · {syncResult.invalid} lỗi
              </p>
              <div className="mt-3 space-y-2">
                {(syncResult.items ?? []).map((item, index) => (
                  <p key={`${item.qrCode}-${index}`} className="break-all text-xs text-gray-600">
                    <span className="font-semibold text-gray-950">{item.status}</span> · {item.message} · {item.qrCode}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

import { useState } from 'react';
import api from '../../api/api';

export default function QrScannerPage() {
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!qrCode.trim()) return;
    const { data } = await api.post('/api/checkins/sync', [{
      qrCode: qrCode.trim(),
      timestamp: new Date().toISOString(),
      deviceId: getDeviceId(),
    }]);
    setResult(data.data?.items?.[0] ?? null);
    setQrCode('');
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-normal">Quét QR check-in</h1>
        <p className="mt-2 text-sm text-gray-600">Bản UI này dùng nhập QR thủ công để kiểm thử API sync và conflict handling.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-semibold text-gray-700" htmlFor="qr">QR code</label>
        <input
          id="qr"
          value={qrCode}
          onChange={(event) => setQrCode(event.target.value)}
          autoFocus
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-3 text-sm"
          placeholder="Dán chuỗi QR vừa quét"
        />
        <button type="submit" className="mt-4 w-full rounded-md bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700">
          Ghi nhận check-in
        </button>
      </form>

      {result && (
        <div className={['mt-4 rounded-lg border p-4 text-sm', result.status === 'CREATED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'].join(' ')}>
          <p className="font-semibold">{result.status}</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}
    </section>
  );
}

function getDeviceId() {
  let deviceId = localStorage.getItem('unihub_checkin_device_id');
  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`;
    localStorage.setItem('unihub_checkin_device_id', deviceId);
  }
  return deviceId;
}

import { useState, useCallback } from 'react';
import api from '../../api/api';
import QrCameraScanner from '../../components/QrCameraScanner';

export default function QrScannerPage() {
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState(null);
  const [useCamera, setUseCamera] = useState(true);

  const processQrString = async (qrString) => {
    if (!qrString.trim()) return;
    
    let finalQr = qrString.trim();
    let qrPayload = null;
    try {
      if (finalQr.startsWith('http')) {
        const url = new URL(finalQr);
        const id = url.searchParams.get('id');
        if (id) {
          finalQr = id;
          qrPayload = {
            studentName: url.searchParams.get('s'),
            workshopTitle: url.searchParams.get('w'),
            room: url.searchParams.get('r'),
            startTime: url.searchParams.get('t')
          };
        }
      } else if (finalQr.includes('--- VÉ ĐIỆN TỬ UNIHUB ---')) {
        const idMatch = finalQr.match(/ID: (.*)/);
        if (idMatch) {
           finalQr = idMatch[1].trim();
           qrPayload = {
             studentName: (finalQr.match(/Sinh viên: (.*)/) || [])[1]?.trim() || '',
             workshopTitle: (finalQr.match(/Workshop: (.*)/) || [])[1]?.trim() || '',
             room: (finalQr.match(/Phòng: (.*)/) || [])[1]?.trim() || '',
             startTime: (finalQr.match(/Thời gian: (.*)/) || [])[1]?.trim() || ''
           };
        }
      } else {
        const parsed = JSON.parse(finalQr);
        qrPayload = parsed;
        if (parsed.qrCode) finalQr = parsed.qrCode;
      }
    } catch (e) {
      // Not JSON or URL, use fallback regex to extract UUID if possible
      const match = finalQr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (match) finalQr = match[0];
    }

    try {
      const { data } = await api.post('/api/checkins/sync', [{
        qrCode: finalQr,
        timestamp: new Date().toISOString(),
        deviceId: getDeviceId(),
      }]);
      const item = data.data?.items?.[0];
      if (item) {
        setResult({ ...item, payload: qrPayload });
      } else {
        setResult(null);
      }
    } catch (err) {
      setResult({ status: 'ERROR', message: 'Lỗi kết nối máy chủ.' });
    }
  };

  const submit = (event) => {
    event.preventDefault();
    processQrString(qrCode);
    setQrCode('');
  };

  const handleScanSuccess = useCallback((decodedText) => {
    // Only process if we haven't just processed this code
    setUseCamera(false); // Optionally pause camera after success
    processQrString(decodedText);
  }, []);

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Quét QR check-in</h1>
          <p className="mt-2 text-sm text-gray-600">Sử dụng camera hoặc nhập mã thủ công để check-in.</p>
        </div>
        <button
          onClick={() => setUseCamera(!useCamera)}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          {useCamera ? 'Nhập thủ công' : 'Bật Camera'}
        </button>
      </div>

      {useCamera ? (
        <div className="mb-6">
          <QrCameraScanner onScanSuccess={handleScanSuccess} />
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm mb-6">
          <label className="text-sm font-semibold text-gray-700" htmlFor="qr">Nhập mã QR thủ công</label>
          <input
            id="qr"
            value={qrCode}
            onChange={(event) => setQrCode(event.target.value)}
            autoFocus
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-3 text-sm"
            placeholder="Dán chuỗi QR..."
          />
          <button type="submit" className="mt-4 w-full rounded-md bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700">
            Ghi nhận check-in
          </button>
        </form>
      )}

      {result && (
        <div className={['mt-4 rounded-lg border p-5 shadow-sm text-sm', result.status === 'CREATED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'].join(' ')}>
          <p className="text-lg font-bold mb-2">{checkinStatusLabel(result.status)}</p>
          <p className="mb-4">{checkinMessage(result)}</p>
          
          {result.payload && (
            <div className="bg-white rounded border border-emerald-100 p-4 space-y-2 text-gray-900 shadow-sm">
              <p><span className="font-semibold text-gray-500 mr-2">Sinh viên:</span> {result.payload.studentName}</p>
              <p><span className="font-semibold text-gray-500 mr-2">Workshop:</span> {result.payload.workshopTitle}</p>
              <p><span className="font-semibold text-gray-500 mr-2">Phòng:</span> {result.payload.room}</p>
              <p><span className="font-semibold text-gray-500 mr-2">Thời gian:</span> {formatDate(result.payload.startTime)}</p>
            </div>
          )}

          {result.status === 'CREATED' && !useCamera && (
            <button onClick={() => { setResult(null); setUseCamera(true); }} className="mt-4 text-emerald-700 underline font-semibold transition hover:text-emerald-800">
              Tiếp tục quét camera
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getDeviceId() {
  let deviceId = localStorage.getItem('unihub_checkin_device_id');
  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`;
    localStorage.setItem('unihub_checkin_device_id', deviceId);
  }
  return deviceId;
}

function checkinStatusLabel(status) {
  const labels = {
    CREATED: 'Đã ghi nhận',
    DUPLICATE: 'Trùng lặp',
    CONFLICT: 'Xung đột',
    INVALID_QR: 'QR không hợp lệ',
    NOT_CONFIRMED: 'Đăng ký chưa được xác nhận',
    ERROR: 'Lỗi',
  };
  return labels[status] ?? status;
}

function checkinMessage(result) {
  const messages = {
    CREATED: 'Check-in đã được ghi nhận',
    DUPLICATE: 'QR đã được check-in trên thiết bị này',
    CONFLICT: 'QR đã được check-in trên thiết bị khác',
    INVALID_QR: 'QR không khớp với đăng ký nào',
    NOT_CONFIRMED: 'Đăng ký chưa được xác nhận',
    ERROR: result.message,
  };
  return messages[result.status] ?? result.message;
}

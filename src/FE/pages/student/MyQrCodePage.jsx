import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/api';

export default function MyQrCodePage() {
  const { registrationId } = useParams();
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get(`/api/registrations/${registrationId}/qr`)
      .then(({ data }) => mounted && setQr(data.data))
      .catch(() => mounted && setError('Mã QR chỉ khả dụng khi đăng ký đã được xác nhận.'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [registrationId]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/student/registrations" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Quay lại đăng ký</Link>
      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-normal text-gray-950">Mã QR check-in</h1>
        {loading && <p className="mt-6 text-sm text-gray-500">Đang tải QR...</p>}
        {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {qr && (
          <div className="mt-6 flex flex-col items-center">
            <img className="h-72 w-72 rounded-lg border border-gray-200 bg-white p-3" src={qr.qrCodeImage} alt="Mã QR" />
            <p className="mt-4 text-lg font-semibold text-gray-950">{qr.workshopTitle}</p>
            <p className="mt-2 break-all rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">{qr.qrCode}</p>
          </div>
        )}
      </div>
    </section>
  );
}

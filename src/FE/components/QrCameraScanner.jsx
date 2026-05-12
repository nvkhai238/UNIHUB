import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrCameraScanner({ onScanSuccess, onScanError }) {
  const [error, setError] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode('qr-reader');
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScanSuccess(decodedText);
          },
          (errorMessage) => {
            if (onScanError) onScanError(errorMessage);
          }
        );
      } catch (err) {
        setError('Không thể khởi động camera. Vui lòng cấp quyền truy cập hoặc kiểm tra thiết bị.');
        console.error(err);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(console.error);
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      {error ? (
        <div className="p-4 bg-red-50 text-red-700 text-sm">{error}</div>
      ) : (
        <div id="qr-reader" className="w-full"></div>
      )}
    </div>
  );
}

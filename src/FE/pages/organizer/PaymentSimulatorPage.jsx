import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';

export default function PaymentSimulatorPage() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadPendingRegistrations();
  }, []);

  const loadPendingRegistrations = async () => {
    setLoading(true);
    try {
      // In a real scenario, we might need a specific endpoint for PENDING payments
      // For simulator, we'll try to find any registration with PENDING status
      const { data } = await api.get('/api/workshops/statistics'); // Example to get some data
      // Actually, let's use a more direct approach if possible, 
      // but since I don't have a "list all pending" for admin yet, 
      // I'll just assume I can fetch them or let the user input a Payment Code.
      
      setRegistrations([]); // Placeholder
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [paymentCode, setPaymentCode] = useState('');
  const [amount, setAmount] = useState('');

  const simulatePayment = async (e) => {
    e.preventDefault();
    setProcessingId('manual');
    setMessage(null);
    try {
      await api.post('/api/webhooks/sepay', {
        id: Math.floor(Math.random() * 1000000),
        gateway: 'VietQR',
        transactionDate: new Date().toISOString(),
        accountNumber: '123456789',
        transferAmount: parseFloat(amount),
        transferType: 'in',
        content: paymentCode,
        code: 'SIMULATED',
        referenceCode: 'SIM-' + Date.now()
      });
      setMessage({ type: 'success', text: `Đã gửi tín hiệu thanh toán thành công cho mã: ${paymentCode}` });
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Lỗi khi gửi webhook giả lập.' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Payment Simulator</h1>
        <p className="mt-2 text-gray-600 italic">Công cụ dành cho Developer để giả lập Webhook từ SePay.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-900 mb-4 flex items-center">
          <span className="mr-2">⚡</span> Giả lập Webhook SePay
        </h2>
        
        <form onSubmit={simulatePayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-amber-800">Mã thanh toán (Nội dung chuyển khoản - UHxxxxxx)</label>
            <input
              type="text"
              required
              value={paymentCode}
              onChange={e => setPaymentCode(e.target.value)}
              placeholder="Ví dụ: UH123456"
              className="mt-1 block w-full rounded-md border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-800">Số tiền (VND)</label>
            <input
              type="number"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Ví dụ: 50000"
              className="mt-1 block w-full rounded-md border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={processingId === 'manual'}
            className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 transition-all"
          >
            {processingId === 'manual' ? 'Đang gửi...' : 'Gửi Webhook thành công'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 rounded-md p-3 text-sm ${
            message.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Hướng dẫn Demo</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
          <li>Mở trang <strong>Đăng ký của tôi</strong> với vai trò Sinh viên.</li>
          <li>Chọn một Workshop có phí và nhấn <strong>Đăng ký</strong>.</li>
          <li>Ở trang Thanh toán, copy <strong>Nội dung chuyển khoản</strong> (ví dụ: UH123456).</li>
          <li>Dán vào ô "Mã thanh toán" phía trên và nhập đúng số tiền.</li>
          <li>Nhấn nút gửi và quan sát trang Thanh toán của Sinh viên tự động cập nhật (Real-time).</li>
        </ul>
      </div>
      
      <div className="mt-6 text-center">
        <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-900">← Quay lại Dashboard Admin</Link>
      </div>
    </div>
  );
}

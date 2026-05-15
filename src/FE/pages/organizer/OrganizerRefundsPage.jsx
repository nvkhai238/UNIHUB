import { useEffect, useState } from 'react';
import api from '../../api/api';
import PaginationControls from '../../components/PaginationControls';
import { formatDateTime } from '../../utils/dateTime';

export default function OrganizerRefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [workshopId, setWorkshopId] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/admin/refunds', { params: { page, size: 10, workshopId: workshopId || undefined } }),
      api.get('/api/workshops/admin', { params: { size: 100 } }),
    ])
      .then(([refundRes, workshopRes]) => {
        setRefunds(refundRes.data.data?.content ?? []);
        setTotalPages(refundRes.data.data?.totalPages ?? 0);
        setWorkshops(workshopRes.data.data?.content ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, workshopId]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Danh sách hoàn tiền</h1>
          <p className="mt-2 text-sm text-gray-600">
            Theo dõi các giao dịch cần BTC hoàn tiền khi workshop bị hủy.
          </p>
        </div>
        <select
          value={workshopId}
          onChange={(event) => {
            setPage(0);
            setWorkshopId(event.target.value);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
        >
          <option value="">Tất cả workshop</option>
          {workshops.map((workshop) => (
            <option key={workshop.id} value={workshop.id}>{workshop.title}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Đang tải danh sách hoàn tiền...</p>
        ) : refunds.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Không có giao dịch hoàn tiền nào phù hợp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Workshop</th>
                  <th className="px-4 py-3">Sinh viên</th>
                  <th className="px-4 py-3">Liên hệ</th>
                  <th className="px-4 py-3">Số tiền</th>
                  <th className="px-4 py-3">Mã thanh toán</th>
                  <th className="px-4 py-3">Hoàn tiền lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refunds.map((refund) => (
                  <tr key={refund.paymentId} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-950">{refund.workshopTitle}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{refund.studentName}</div>
                      <div className="text-xs text-gray-500">{refund.studentCode || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{refund.studentEmail}</div>
                      <div>{refund.studentPhone || '-'}</div>
                      <div>{refund.telegramId || '-'}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatMoney(refund.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{refund.paymentCode || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(refund.refundedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
    </section>
  );
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString('vi-VN')} d`;
}

function formatDate(value) {
  return formatDateTime(value, '-');
}

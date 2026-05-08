import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import RegistrationButton from '../../components/RegistrationButton';
import api from '../../api/api';

export default function WorkshopDetailPage() {
  const { id } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    api.get(`/api/workshops/${id}`)
      .then(({ data }) => mounted && setWorkshop(data.data))
      .catch(() => mounted && setError('Không tải được chi tiết workshop.'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) return <Shell><StateBox text="Đang tải chi tiết..." /></Shell>;
  if (error) return <Shell><StateBox text={error} tone="error" /></Shell>;
  if (!workshop) return <Shell><StateBox text="Không tìm thấy workshop." tone="error" /></Shell>;

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{workshop.status}</span>
            <span className="text-gray-500">{formatDate(workshop.startTime)}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-gray-950">{workshop.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{workshop.description || 'Chưa có mô tả.'}</p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Info label="Diễn giả" value={workshop.speakerName || 'Đang cập nhật'} />
            <Info label="Phòng" value={workshop.room} />
            <Info label="Thời gian bắt đầu" value={formatDate(workshop.startTime)} />
            <Info label="Thời gian kết thúc" value={formatDate(workshop.endTime)} />
          </dl>

          {(workshop.pdfUrl || workshop.aiSummary) && (
            <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
              {workshop.pdfUrl && (
                <a
                  className="text-sm font-semibold text-emerald-700 underline"
                  href={workshop.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Xem tài liệu PDF của workshop
                </a>
              )}
              {workshop.aiSummary && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{workshop.aiSummary}</p>
              )}
            </div>
          )}
        </article>

        <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-sm text-gray-500">Số ghế còn lại</p>
            <p className="mt-1 text-3xl font-bold text-gray-950">{workshop.remainingSeats}/{workshop.capacity}</p>
            <p className="mt-2 text-sm font-semibold text-gray-950">{formatPrice(workshop.price)}</p>
          </div>

          <RegistrationButton
            workshopId={workshop.id}
            workshopPrice={Number(workshop.price ?? 0)}
            remainingSeats={workshop.remainingSeats ?? 0}
            onSuccess={setResult}
          />

          {result && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">{statusMessage(result.status)}</p>
              {result.status === 'CONFIRMED' && (
                <Link className="mt-2 inline-block font-semibold underline" to={`/student/registrations/${result.registrationId || result.id}/qr`}>
                  Xem mã QR
                </Link>
              )}
              {result.status === 'PENDING' && (
                <Link className="mt-2 inline-block font-semibold underline" to="/student/registrations">
                  Theo dõi thanh toán
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <section className="mx-auto max-w-6xl px-4 py-8">{children}</section>;
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-950">{value}</dd>
    </div>
  );
}

function StateBox({ text, tone = 'default' }) {
  return (
    <div className={['rounded-lg border p-4 text-sm', tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'].join(' ')}>
      {text}
    </div>
  );
}

function statusMessage(status) {
  if (status === 'CONFIRMED') return 'Đăng ký thành công. Mã QR đã sẵn sàng.';
  if (status === 'WAITLISTED') return 'Workshop đã hết chỗ. Bạn đã vào danh sách chờ.';
  if (status === 'PENDING') return 'Đăng ký đã giữ chỗ. Thanh toán đang được xử lý.';
  return 'Yêu cầu đã được ghi nhận.';
}

function formatDate(value) {
  if (!value) return 'Chưa có lịch';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPrice(value) {
  const amount = Number(value ?? 0);
  return amount === 0 ? 'Miễn phí' : `${amount.toLocaleString('vi-VN')}đ`;
}

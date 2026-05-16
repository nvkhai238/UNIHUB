import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import RegistrationButton from '../../components/RegistrationButton';
import api from '../../api/api';
import { getCurrentUser } from '../../router/jwtUtils';
import { useWorkshopRealtime } from '../../hooks/useWorkshopRealtime';
import { formatDateTime } from '../../utils/dateTime';

export default function WorkshopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workshop, setWorkshop] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [existingRegistration, setExistingRegistration] = useState(null);

  const currentUser = getCurrentUser();

  const refreshRegistrationState = useCallback((workshopData) => {
    if (currentUser?.role !== 'STUDENT') return;
    api.get(`/api/registrations/my/workshops/${workshopData?.id}`)
      .then(({ data }) => {
        const existing = data.data ?? null;
        setAlreadyRegistered(!!existing);
        setExistingRegistration(existing || null);
        if (!existing) setResult(null);
      })
      .catch(() => {});
  }, [currentUser?.role]);

  const handleWorkshopRealtimeUpdate = useCallback((payload) => {
    setWorkshop((prev) => (prev ? { ...prev, ...payload } : payload));
  }, []);

  const { realtimeAvailable } = useWorkshopRealtime({
    workshopId: id,
    onWorkshopUpdate: handleWorkshopRealtimeUpdate,
  });

  useEffect(() => {
    let mounted = true;

    const fetchAll = () => Promise.all([
      api.get(`/api/workshops/${id}`),
      currentUser?.role === 'STUDENT'
        ? api.get(`/api/registrations/my/workshops/${id}`).catch(() => ({ data: { data: null } }))
        : Promise.resolve({ data: { data: null } }),
    ]);

    fetchAll()
      .then(([workshopRes, registrationsRes]) => {
        if (!mounted) return;
        const workshopData = workshopRes.data.data;
        setWorkshop(workshopData);
        const existing = registrationsRes.data?.data ?? null;

        setAlreadyRegistered(!!existing);
        setExistingRegistration(existing || null);
      })
      .catch(() => mounted && setError('Không tải được chi tiết workshop.'))
      .finally(() => mounted && setLoading(false));

    const poll = () => {
      api.get(`/api/workshops/${id}`)
        .then(({ data }) => {
          if (!mounted) return;
          setWorkshop(data.data);
          refreshRegistrationState(data.data);
        })
        .catch(() => {});
    };

    const interval = setInterval(poll, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentUser?.role, id, refreshRegistrationState]);

  if (loading) return <Shell><StateBox text="Đang tải chi tiết..." /></Shell>;
  if (error) return <Shell><StateBox text={error} tone="error" /></Shell>;
  if (!workshop) return <Shell><StateBox text="Không tìm thấy workshop." tone="error" /></Shell>;

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{workshopStatusLabel(workshop.status)}</span>
            <span className="text-gray-500">{formatDate(workshop.startTime)}</span>
            <span className="text-xs text-gray-400">
              {realtimeAvailable ? 'Realtime đang kết nối' : 'Đang fallback polling 5s'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-gray-950">{workshop.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{workshop.description || 'Chưa có mô tả.'}</p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Info label="Diễn giả" value={workshop.speakerName || 'Đang cập nhật'} />
            <Info label="Phòng" value={workshop.room} />
            <Info label="Thời gian bắt đầu" value={formatDate(workshop.startTime)} />
            <Info label="Thời gian kết thúc" value={formatDate(workshop.endTime)} />
          </dl>

          {workshop.speakerBio && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="mb-2 text-sm font-semibold uppercase text-gray-500">Tiểu sử diễn giả</h3>
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{workshop.speakerBio}</p>
            </div>
          )}

          {(workshop.pdfUrl || workshop.aiSummary || workshop.roomLayoutUrl) && (
            <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
              {workshop.roomLayoutUrl && (
                <a
                  className="mb-3 block text-sm font-semibold text-emerald-700 underline"
                  href={workshop.roomLayoutUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Xem sơ đồ phòng
                </a>
              )}
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

          {/* Banner ENDED */}
          {workshop.timePhase === 'ENDED' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">🏁 Workshop đã kết thúc</p>
              <p className="mt-1">Workshop này đã diễn ra xong. Không thể đăng ký.</p>
            </div>
          )}

          {/* Banner ONGOING */}
          {workshop.timePhase === 'ONGOING' && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              <p className="font-semibold">🔴 Workshop đang diễn ra</p>
              <p className="mt-1">Workshop đang trong quá trình diễn ra, không nhận đăng ký mới.</p>
            </div>
          )}

          {/* Nút đăng ký — chỉ hiển thị khi UPCOMING */}
          {(!workshop.timePhase || workshop.timePhase === 'UPCOMING') && (
            <RegistrationButton
              workshopId={workshop.id}
              workshopPrice={Number(workshop.price ?? 0)}
              remainingSeats={workshop.remainingSeats ?? 0}
              alreadyRegistered={alreadyRegistered}
              onSuccess={(data) => {
                setResult(data);
                setAlreadyRegistered(true);
                if (data.status === 'PENDING') {
                  navigate(`/student/registrations/${data.registrationId || data.id}/payment`);
                }
              }}
            />
          )}

          {/* Vẫn hiện QR / payment link dù workshop đã bắt đầu/kết thúc */}
          {alreadyRegistered && !result && existingRegistration && (
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Bạn đã đăng ký workshop này.</p>

              {existingRegistration.status === 'PENDING' && (
                <button
                  onClick={() => navigate(`/student/registrations/${existingRegistration.registrationId || existingRegistration.id}/payment`)}
                  className="w-full rounded-md bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
                >
                  Tiếp tục thanh toán
                </button>
              )}

              {existingRegistration.status === 'CONFIRMED' && (
                <button
                  onClick={() => navigate(`/student/registrations/${existingRegistration.registrationId || existingRegistration.id}/qr`)}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                >
                  Xem mã QR check-in
                </button>
              )}

              <Link className="block text-center font-semibold text-emerald-700 underline" to="/student/registrations">
                Quản lý đăng ký của tôi
              </Link>
            </div>
          )}

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

function workshopStatusLabel(status) {
  const labels = {
    DRAFT: 'Nháp',
    PUBLISHED: 'Đã xuất bản',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] ?? status;
}

function formatDate(value) {
  return formatDateTime(value, 'Chưa có lịch');
}

function formatPrice(value) {
  const amount = Number(value ?? 0);
  return amount === 0 ? 'Miễn phí' : `${amount.toLocaleString('vi-VN')}đ`;
}

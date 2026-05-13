import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import RegistrationButton from '../../components/RegistrationButton';
import api from '../../api/api';
import { getCurrentUser } from '../../router/jwtUtils';
import { useWorkshopRealtime } from '../../hooks/useWorkshopRealtime';

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
    api.get('/api/registrations/my?size=50')
      .then(({ data }) => {
        const myRegistrations = data.data?.content ?? [];
        const existing = myRegistrations.find((r) => r.workshopId === workshopData?.id && r.status !== 'CANCELLED');
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
        ? api.get('/api/registrations/my?size=50').catch(() => ({ data: { data: { content: [] } } }))
        : Promise.resolve({ data: { data: [] } }),
    ]);

    fetchAll()
      .then(([workshopRes, registrationsRes]) => {
        if (!mounted) return;
        const workshopData = workshopRes.data.data;
        setWorkshop(workshopData);

        const myRegistrations = registrationsRes.data?.data?.content ?? [];
        const existing = myRegistrations.find((registration) =>
          registration.workshopId === workshopData?.id && registration.status !== 'CANCELLED');

        setAlreadyRegistered(!!existing);
        setExistingRegistration(existing || null);
      })
      .catch(() => mounted && setError('Khong tai duoc chi tiet workshop.'))
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

  if (loading) return <Shell><StateBox text="Dang tai chi tiet..." /></Shell>;
  if (error) return <Shell><StateBox text={error} tone="error" /></Shell>;
  if (!workshop) return <Shell><StateBox text="Khong tim thay workshop." tone="error" /></Shell>;

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{workshopStatusLabel(workshop.status)}</span>
            <span className="text-gray-500">{formatDate(workshop.startTime)}</span>
            <span className="text-xs text-gray-400">
              {realtimeAvailable ? 'Realtime dang ket noi' : 'Dang fallback polling 5s'}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-gray-950">{workshop.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{workshop.description || 'Chua co mo ta.'}</p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Info label="Dien gia" value={workshop.speakerName || 'Dang cap nhat'} />
            <Info label="Phong" value={workshop.room} />
            <Info label="Thoi gian bat dau" value={formatDate(workshop.startTime)} />
            <Info label="Thoi gian ket thuc" value={formatDate(workshop.endTime)} />
          </dl>

          {workshop.speakerBio && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="mb-2 text-sm font-semibold uppercase text-gray-500">Tieu su dien gia</h3>
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
                  Xem so do phong
                </a>
              )}
              {workshop.pdfUrl && (
                <a
                  className="text-sm font-semibold text-emerald-700 underline"
                  href={workshop.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Xem tai lieu PDF cua workshop
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
            <p className="text-sm text-gray-500">So ghe con lai</p>
            <p className="mt-1 text-3xl font-bold text-gray-950">{workshop.remainingSeats}/{workshop.capacity}</p>
            <p className="mt-2 text-sm font-semibold text-gray-950">{formatPrice(workshop.price)}</p>
          </div>

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

          {alreadyRegistered && !result && existingRegistration && (
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Ban da dang ky workshop nay.</p>

              {existingRegistration.status === 'PENDING' && (
                <button
                  onClick={() => navigate(`/student/registrations/${existingRegistration.registrationId || existingRegistration.id}/payment`)}
                  className="w-full rounded-md bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
                >
                  Tiep tuc thanh toan
                </button>
              )}

              {existingRegistration.status === 'CONFIRMED' && (
                <button
                  onClick={() => navigate(`/student/registrations/${existingRegistration.registrationId || existingRegistration.id}/qr`)}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                >
                  Xem ma QR check-in
                </button>
              )}

              <Link className="block text-center font-semibold text-emerald-700 underline" to="/student/registrations">
                Quan ly dang ky cua toi
              </Link>
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">{statusMessage(result.status)}</p>
              {result.status === 'CONFIRMED' && (
                <Link className="mt-2 inline-block font-semibold underline" to={`/student/registrations/${result.registrationId || result.id}/qr`}>
                  Xem ma QR
                </Link>
              )}
              {result.status === 'PENDING' && (
                <Link className="mt-2 inline-block font-semibold underline" to="/student/registrations">
                  Theo doi thanh toan
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
  if (status === 'CONFIRMED') return 'Dang ky thanh cong. Ma QR da san sang.';
  if (status === 'WAITLISTED') return 'Workshop da het cho. Ban da vao danh sach cho.';
  if (status === 'PENDING') return 'Dang ky da giu cho. Thanh toan dang duoc xu ly.';
  return 'Yeu cau da duoc ghi nhan.';
}

function workshopStatusLabel(status) {
  const labels = {
    DRAFT: 'Nhap',
    PUBLISHED: 'Da xuat ban',
    CANCELLED: 'Da huy',
  };
  return labels[status] ?? status;
}

function formatDate(value) {
  if (!value) return 'Chua co lich';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPrice(value) {
  const amount = Number(value ?? 0);
  return amount === 0 ? 'Mien phi' : `${amount.toLocaleString('vi-VN')}d`;
}

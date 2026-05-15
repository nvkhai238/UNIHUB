import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';
import { formatDateTime } from '../../utils/dateTime';

export default function StudentDashboard() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get('/api/registrations/my?size=5')
      .then(({ data }) => mounted && setRegistrations(data.data?.content ?? []))
      .catch(() => mounted && setRegistrations([]))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => ({
    confirmed: registrations.filter((item) => item.status === 'CONFIRMED').length,
    pending: registrations.filter((item) => item.status === 'PENDING').length,
    waitlisted: registrations.filter((item) => item.status === 'WAITLISTED').length,
  }), [registrations]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Tong quan sinh vien</h1>
          <p className="mt-2 text-sm text-gray-600">Theo doi dang ky, thanh toan pending va ma QR check-in.</p>
        </div>
        <Link
          to="/student/workshops"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Xem lich workshop
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Metric label="Da xac nhan" value={summary.confirmed} />
        <Metric label="Dang thanh toan" value={summary.pending} />
        <Metric label="Danh sach cho" value={summary.waitlisted} />
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dang ky gan day</h2>
          <Link to="/student/registrations" className="text-sm font-semibold text-emerald-700">
            Xem tat ca
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Dang tai...</p>
        ) : registrations.length === 0 ? (
          <p className="text-sm text-gray-500">Ban chua dang ky workshop nao.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {registrations.map((registration) => (
              <div key={registration.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-gray-950">{registration.workshopTitle || registration.workshopId}</p>
                  <p className="text-sm text-gray-500">{formatDate(registration.registeredAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={registration.status} />
                  <Link
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    to={`/student/registrations/${registration.id}`}
                  >
                    Chi tiet
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-700',
    WAITLISTED: 'bg-sky-50 text-sky-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles[status] ?? styles.CANCELLED}`}>
      {registrationStatusLabel(status)}
    </span>
  );
}

function registrationStatusLabel(status) {
  const labels = {
    CONFIRMED: 'Da xac nhan',
    PENDING: 'Dang xu ly',
    WAITLISTED: 'Danh sach cho',
    CANCELLED: 'Da huy',
  };
  return labels[status] ?? status;
}

function formatDate(value) {
  return formatDateTime(value);
}

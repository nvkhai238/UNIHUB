import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/api';

const initialForm = {
  title: '',
  description: '',
  speakerName: '',
  speakerBio: '',
  room: '',
  roomLayoutUrl: '',
  startTime: '',
  endTime: '',
  capacity: 30,
  price: 0,
  pdfUrl: '',
};

export default function WorkshopManagePage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isCreateModalOpen = useMemo(
    () => location.pathname === '/admin/workshops/create',
    [location.pathname],
  );

  const load = () => {
    setLoading(true);
    api.get('/api/workshops/admin?size=50')
      .then(({ data }) => setWorkshops(data.data?.content ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!isCreateModalOpen) {
      setForm(initialForm);
      setFormError('');
      setSubmitting(false);
    }
  }, [isCreateModalOpen]);

  const publish = async (id) => {
    await api.patch(`/api/workshops/${id}/status`, { status: 'PUBLISHED' });
    setMessage('Workshop da duoc xuat ban.');
    load();
  };

  const cancel = async (id) => {
    await api.post(`/api/workshops/${id}/cancel`);
    setMessage('Workshop da huy. Cac giao dich lien quan se duoc xu ly hoan tien va gui thong bao bat dong bo.');
    load();
  };

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const closeModal = () => {
    navigate('/admin/workshops', { replace: true });
  };

  const openCreateModal = () => {
    navigate('/admin/workshops/create');
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/api/workshops', toPayload(form));
      setMessage('Tao workshop thanh cong. Workshop moi dang o trang thai nhap.');
      navigate('/admin/workshops', { replace: true });
      load();
    } catch {
      setFormError('Khong tao duoc workshop. Kiem tra lai du lieu nhap.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Quan ly Workshop</h1>
          <p className="mt-2 text-sm text-gray-600">
            Theo doi trang thai, ghe con lai va thao tac xuat ban hoac huy.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Tao workshop
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Dang tai...</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {workshops.map((workshop) => (
              <div key={workshop.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-950">{workshop.title}</h2>
                    <StatusBadge status={workshop.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatDate(workshop.startTime)} · {workshop.room}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Ghe con lai {workshop.remainingSeats}/{workshop.capacity}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    to={`/admin/workshops/${workshop.id}/edit`}
                  >
                    Sửa
                  </Link>
                  <Link
                    className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    to={`/admin/workshops/${workshop.id}/registrations`}
                  >
                    Danh sách vé
                  </Link>
                  {workshop.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => publish(workshop.id)}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Xuat ban
                    </button>
                  )}
                  {workshop.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => cancel(workshop.id)}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Huy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 px-4 py-8"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-normal text-gray-950">Tao workshop moi</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Workshop moi se o trang thai nhap de ban to chuc kiem tra truoc khi xuat ban.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Dong
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={submitCreate} className="mt-6 grid gap-4">
              <Field label="Tieu de" value={form.title} onChange={(value) => update('title', value)} required />
              <Field label="Dien gia" value={form.speakerName} onChange={(value) => update('speakerName', value)} />
              <Field label="Phong" value={form.room} onChange={(value) => update('room', value)} required />
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Bat dau"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(value) => update('startTime', value)}
                  required
                />
                <Field
                  label="Ket thuc"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(value) => update('endTime', value)}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Suc chua"
                  type="number"
                  value={form.capacity}
                  onChange={(value) => update('capacity', Number(value))}
                  required
                />
                <Field
                  label="Gia ve"
                  type="number"
                  value={form.price}
                  onChange={(value) => update('price', Number(value))}
                  required
                />
              </div>
              <Textarea label="Mo ta" value={form.description} onChange={(value) => update('description', value)} />
              <Textarea label="Bio dien gia" value={form.speakerBio} onChange={(value) => update('speakerBio', value)} />
              <Field
                label="URL so do phong"
                value={form.roomLayoutUrl}
                onChange={(value) => update('roomLayoutUrl', value)}
              />
              <Field
                label="URL tai lieu PDF"
                value={form.pdfUrl}
                onChange={(value) => update('pdfUrl', value)}
              />

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Huy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Dang tao...' : 'Tao workshop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PUBLISHED: 'bg-emerald-50 text-emerald-700',
    DRAFT: 'bg-amber-50 text-amber-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles[status] ?? styles.DRAFT}`}>
      {workshopStatusLabel(status)}
    </span>
  );
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
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function toPayload(form) {
  return {
    ...form,
    startTime: new Date(form.startTime).toISOString(),
    endTime: new Date(form.endTime).toISOString(),
    price: Number(form.price),
    capacity: Number(form.capacity),
  };
}

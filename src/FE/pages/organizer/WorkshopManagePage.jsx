import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import PaginationControls from '../../components/PaginationControls';
import { formatDateTime } from '../../utils/dateTime';

function createEmptyForm() {
  return {
    title: '',
    description: '',
    speakerName: '',
    speakerBio: '',
    room: '',
    roomLayoutUrl: '',
    startTime: '',
    endTime: '',
    capacity: '30',
    price: '0',
    pdfUrl: '',
  };
}

export default function WorkshopManagePage() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(createEmptyForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const isCreateModalOpen = useMemo(
    () => location.pathname === '/admin/workshops/create',
    [location.pathname],
  );

  const load = () => {
    setLoading(true);
    api.get('/api/workshops/admin', { params: { page, size: 10 } })
      .then(({ data }) => {
        setWorkshops(data.data?.content ?? []);
        setTotalPages(data.data?.totalPages ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page]);

  useEffect(() => {
    if (!isCreateModalOpen) {
      setForm(createEmptyForm());
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
    setMessage('Workshop da huy. Neu co giao dich thanh cong, sinh vien se nhan huong dan dien form hoan tien.');
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
    const nextError = getWorkshopFormError(form);
    setFormError(nextError);
    if (nextError) {
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/workshops', toPayload(form));
      setMessage('Tao workshop thanh cong. Workshop moi dang o trang thai nhap.');
      navigate('/admin/workshops', { replace: true });
      setPage(0);
      load();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Khong tao duoc workshop. Kiem tra lai du lieu nhap.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Quan ly workshop</h1>
          <p className="mt-2 text-sm text-gray-600">
            Theo doi trang thai, ghe con lai va thao tac xuat ban hoac huy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/refunds"
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Danh sach refund
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Tao workshop
          </button>
        </div>
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
                    {formatDate(workshop.startTime)} | {workshop.room}
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
                    Sua
                  </Link>
                  <Link
                    className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    to={`/admin/workshops/${workshop.id}/registrations`}
                  >
                    Danh sach ve
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

      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/40 px-4 py-8" onClick={closeModal}>
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
                  min={getDateTimeMin()}
                  required
                />
                <Field
                  label="Ket thuc"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(value) => update('endTime', value)}
                  min={form.startTime || getDateTimeMin()}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <NumericField label="Suc chua" value={form.capacity} onChange={(value) => update('capacity', value)} />
                <NumericField label="Gia ve" value={form.price} onChange={(value) => update('price', value)} />
              </div>
              <Textarea label="Mo ta" value={form.description} onChange={(value) => update('description', value)} />
              <Textarea label="Bio dien gia" value={form.speakerBio} onChange={(value) => update('speakerBio', value)} />
              <Field label="URL so do phong" value={form.roomLayoutUrl} onChange={(value) => update('roomLayoutUrl', value)} />
              <Field label="URL tai lieu PDF" value={form.pdfUrl} onChange={(value) => update('pdfUrl', value)} />

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

function Field({ label, value, onChange, type = 'text', min, required = false }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input
        type={type}
        min={min}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function NumericField({ label, value, onChange }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onFocus={(event) => {
          if (event.target.value === '0') {
            event.target.select();
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (/^\d*$/.test(nextValue)) {
            onChange(nextValue);
          }
        }}
        onBlur={() => onChange(normalizeNumericValue(value))}
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
  return formatDateTime(value);
}

function normalizeNumericValue(value) {
  if (!value) return '0';
  return String(Number(value));
}

function getWorkshopFormError(form) {
  if (!form.title.trim() || !form.room.trim() || !form.startTime || !form.endTime) {
    return 'Vui long dien day du cac truong bat buoc.';
  }

  const startTime = new Date(form.startTime);
  const endTime = new Date(form.endTime);
  const now = new Date();

  if (!(startTime > now)) {
    return 'Thoi gian bat dau phai tre hon thoi diem hien tai.';
  }
  if (!(endTime > startTime)) {
    return 'Thoi gian ket thuc phai sau thoi gian bat dau.';
  }

  if (Number(form.capacity) <= 0) {
    return 'Suc chua phai lon hon 0.';
  }
  if (Number(form.price) < 0) {
    return 'Gia ve khong duoc am.';
  }

  return '';
}

function toPayload(form) {
  return {
    ...form,
    startTime: new Date(form.startTime).toISOString(),
    endTime: new Date(form.endTime).toISOString(),
    price: Number(normalizeNumericValue(form.price)),
    capacity: Number(normalizeNumericValue(form.capacity)),
  };
}

function getDateTimeMin() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

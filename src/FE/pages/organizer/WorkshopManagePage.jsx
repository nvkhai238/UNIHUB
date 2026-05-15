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
    setMessage('Workshop đã được xuất bản.');
    load();
  };

  const cancel = async (id) => {
    await api.post(`/api/workshops/${id}/cancel`);
    setMessage('Workshop đã hủy. Nếu có giao dịch thành công, sinh viên sẽ nhận hướng dẫn điền form hoàn tiền.');
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
      setMessage('Tạo workshop thành công. Workshop mới đang ở trạng thái nháp.');
      navigate('/admin/workshops', { replace: true });
      setPage(0);
      load();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Không tạo được workshop. Kiểm tra lại dữ liệu nhập.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Quản lý workshop</h1>
          <p className="mt-2 text-sm text-gray-600">
            Theo dõi trạng thái, ghế còn lại và thao tác xuất bản hoặc hủy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/refunds"
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Danh sách hoàn tiền
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Tạo workshop
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
          <p className="p-5 text-sm text-gray-500">Đang tải...</p>
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
                    Ghế còn lại {workshop.remainingSeats}/{workshop.capacity}
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
                      Xuất bản
                    </button>
                  )}
                  {workshop.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => cancel(workshop.id)}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Hủy
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
                <h2 className="text-2xl font-bold tracking-normal text-gray-950">Tạo workshop mới</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Workshop mới sẽ ở trạng thái nháp để ban tổ chức kiểm tra trước khi xuất bản.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={submitCreate} className="mt-6 grid gap-4">
              <Field label="Tiêu đề" value={form.title} onChange={(value) => update('title', value)} required />
              <Field label="Diễn giả" value={form.speakerName} onChange={(value) => update('speakerName', value)} />
              <Field label="Phòng" value={form.room} onChange={(value) => update('room', value)} required />
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Bắt đầu"
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(value) => update('startTime', value)}
                  min={getDateTimeMin()}
                  required
                />
                <Field
                  label="Kết thúc"
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(value) => update('endTime', value)}
                  min={form.startTime || getDateTimeMin()}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <NumericField label="Sức chứa" value={form.capacity} onChange={(value) => update('capacity', value)} />
                <NumericField label="Giá vé" value={form.price} onChange={(value) => update('price', value)} />
              </div>
              <Textarea label="Mô tả" value={form.description} onChange={(value) => update('description', value)} />
              <Textarea label="Bio diễn giả" value={form.speakerBio} onChange={(value) => update('speakerBio', value)} />
              <Field label="URL sơ đồ phòng" value={form.roomLayoutUrl} onChange={(value) => update('roomLayoutUrl', value)} />
              <Field label="URL tài liệu PDF" value={form.pdfUrl} onChange={(value) => update('pdfUrl', value)} />

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo workshop'}
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
    DRAFT: 'Nháp',
    PUBLISHED: 'Đã xuất bản',
    CANCELLED: 'Đã hủy',
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
    return 'Vui lòng điền đầy đủ các trường bắt buộc.';
  }

  const startTime = new Date(form.startTime);
  const endTime = new Date(form.endTime);
  const now = new Date();

  if (!(startTime > now)) {
    return 'Thời gian bắt đầu phải trễ hơn thời điểm hiện tại.';
  }
  if (!(endTime > startTime)) {
    return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  }

  if (Number(form.capacity) <= 0) {
    return 'Sức chứa phải lớn hơn 0.';
  }
  if (Number(form.price) < 0) {
    return 'Giá vé không được âm.';
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

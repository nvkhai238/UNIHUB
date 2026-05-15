import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/api';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export default function WorkshopEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const pdfInputRef = useRef(null);
  const [form, setForm] = useState(null);
  const [workshopStatus, setWorkshopStatus] = useState('');
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadTone, setUploadTone] = useState('info');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiSummaryStatus, setAiSummaryStatus] = useState('NONE');

  useEffect(() => {
    api.get(`/api/workshops/${id}`)
      .then(({ data }) => {
        setForm(fromWorkshop(data.data));
        setWorkshopStatus(data.data?.status ?? '');
        setAiSummary(data.data?.aiSummary ?? '');
        setAiSummaryStatus(data.data?.aiSummaryStatus ?? 'NONE');
      })
      .catch(() => setError('Không tải được workshop.'));
  }, [id]);

  useEffect(() => {
    let interval;
    if (aiSummaryStatus === 'PROCESSING') {
      interval = setInterval(() => {
        api.get(`/api/workshops/${id}/ai-summary/status`)
          .then(({ data }) => {
            const nextStatus = data.data?.aiSummaryStatus ?? 'NONE';
            if (nextStatus !== 'PROCESSING') {
              setAiSummaryStatus(nextStatus);
              setAiSummary(data.data?.aiSummary ?? '');
              clearInterval(interval);
            }
          })
          .catch(() => {});
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [id, aiSummaryStatus]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const nextError = getWorkshopFormError(form);
    setError(nextError);
    setActionMsg('');
    if (nextError) {
      return;
    }

    try {
      await api.put(`/api/workshops/${id}`, toPayload(form));
      setActionMsg('Lưu thay đổi thành công.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không cập nhật được workshop.');
    }
  };

  const changeStatus = async (targetStatus) => {
    setError('');
    setActionMsg('');
    try {
      await api.patch(`/api/workshops/${id}/status`, { status: targetStatus });
      setWorkshopStatus(targetStatus);
      setActionMsg(`Trạng thái đã chuyển sang ${workshopStatusLabel(targetStatus)}.`);
    } catch (err) {
      setError(err?.response?.data?.message || `Không đổi được trạng thái thành ${workshopStatusLabel(targetStatus)}.`);
    }
  };

  const uploadPdf = async (file) => {
    if (!file) return;

    if (!isPdfFile(file)) {
      setUploadTone('error');
      setUploadMessage('Chỉ được tải file PDF.');
      resetPdfInput();
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setUploadTone('error');
      setUploadMessage(`PDF tối đa 10MB. File hiện tại khoảng ${formatFileSize(file.size)}.`);
      resetPdfInput();
      return;
    }

    setUploadingPdf(true);
    setUploadMessage('');
    try {
      const payload = new FormData();
      payload.append('file', file);
      const { data } = await api.post(`/api/workshops/${id}/pdf`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const pdfUrl = data.data?.pdfUrl ?? data.data;
      const status = data.data?.aiSummaryStatus ?? 'PROCESSING';
      setUploadTone('success');
      setUploadMessage('PDF đã tải lên, tóm tắt AI đang được xử lý nền.');
      setForm((prev) => ({ ...prev, pdfUrl: pdfUrl ?? prev.pdfUrl }));
      setAiSummary('');
      setAiSummaryStatus(status);
    } catch (err) {
      setUploadTone('error');
      setUploadMessage(err?.response?.data?.message || 'Không tải được PDF. Vui lòng thử lại.');
    } finally {
      setUploadingPdf(false);
      resetPdfInput();
    }
  };

  const refreshAiSummary = async () => {
    const { data } = await api.get(`/api/workshops/${id}/ai-summary/status`);
    setAiSummary(data.data?.aiSummary ?? '');
    setAiSummaryStatus(data.data?.aiSummaryStatus ?? 'NONE');
  };

  const retryAiSummary = async () => {
    setUploadMessage('');
    try {
      await api.post(`/api/workshops/${id}/ai-summary/retry`);
      setAiSummaryStatus('PROCESSING');
      setUploadTone('info');
      setUploadMessage('Đã đưa yêu cầu tạo lại tóm tắt AI vào hàng xử lý.');
    } catch (err) {
      setUploadTone('error');
      setUploadMessage(err?.response?.data?.message || 'Không thể tạo lại tóm tắt AI lúc này.');
    }
  };

  if (!form) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">
          {error || 'Đang tải workshop...'}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-normal">Chỉnh sửa workshop</h1>
        {workshopStatus && (
          <span className={`rounded-md border px-3 py-1 text-sm font-semibold ${statusStyle(workshopStatus)}`}>
            {workshopStatusLabel(workshopStatus)}
          </span>
        )}
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {uploadMessage && <div className={`mb-4 rounded-lg border p-4 text-sm ${uploadNoticeClass(uploadTone)}`}>{uploadMessage}</div>}
      {actionMsg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{actionMsg}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {workshopStatus === 'DRAFT' && (
          <button
            type="button"
            onClick={() => changeStatus('PUBLISHED')}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Xuất bản workshop
          </button>
        )}
        {workshopStatus === 'PUBLISHED' && (
          <button
            type="button"
            onClick={() => changeStatus('CANCELLED')}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Hủy workshop
          </button>
        )}
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <Field label="Tiêu đề" value={form.title} onChange={(value) => update('title', value)} required />
        <Field label="Diễn giả" value={form.speakerName} onChange={(value) => update('speakerName', value)} />
        <Field label="Phòng" value={form.room} onChange={(value) => update('room', value)} required />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Bắt đầu"
            type="datetime-local"
            value={form.startTime}
            min={getDateTimeMin()}
            onChange={(value) => update('startTime', value)}
            required
          />
          <Field
            label="Kết thúc"
            type="datetime-local"
            value={form.endTime}
            min={form.startTime || getDateTimeMin()}
            onChange={(value) => update('endTime', value)}
            required
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <NumericField label="Sức chứa" value={form.capacity} onChange={(value) => update('capacity', value)} />
          <NumericField label="Giá vé (VND)" value={form.price} onChange={(value) => update('price', value)} />
        </div>
        <Textarea label="Mô tả" value={form.description} onChange={(value) => update('description', value)} />
        <Textarea label="Bio diễn giả" value={form.speakerBio} onChange={(value) => update('speakerBio', value)} />
        <Field label="URL sơ đồ phòng" value={form.roomLayoutUrl} onChange={(value) => update('roomLayoutUrl', value)} />
        <label className="text-sm font-semibold text-gray-700">
          Tải PDF tài liệu
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            disabled={uploadingPdf || workshopStatus === 'CANCELLED'}
            onChange={(event) => uploadPdf(event.target.files?.[0])}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
          />
        </label>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Tóm tắt AI</p>
          <p className={`mt-1 text-sm font-semibold ${
            aiSummaryStatus === 'PROCESSING' ? 'text-blue-600'
              : aiSummaryStatus === 'FAILED' ? 'text-red-600'
                : aiSummaryStatus === 'DONE' ? 'text-green-600'
                  : 'text-gray-950'
          }`}
          >
            {aiSummaryStatusLabel(aiSummaryStatus)}
          </p>
          {aiSummary && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{aiSummary}</p>
          )}
          {aiSummaryStatus === 'PROCESSING' && (
            <p className="mt-2 text-sm text-blue-600">AI đang xử lý PDF, tóm tắt sẽ hiển thị sau vài phút.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshAiSummary}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cập nhật trạng thái
            </button>
            {aiSummaryStatus === 'FAILED' && (
              <button
                type="button"
                onClick={retryAiSummary}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Tạo lại tóm tắt AI
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={workshopStatus === 'CANCELLED'}
            className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lưu thay đổi
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/workshops')}
            className="rounded-md border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Quay lại
          </button>
        </div>
      </form>
    </section>
  );

  function resetPdfInput() {
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  }
}

function Field({ label, value, onChange, type = 'text', min, required = false }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input
        type={type}
        min={min}
        value={value ?? ''}
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
        value={value ?? ''}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function fromWorkshop(workshop) {
  return {
    title: workshop.title ?? '',
    description: workshop.description ?? '',
    speakerName: workshop.speakerName ?? '',
    speakerBio: workshop.speakerBio ?? '',
    room: workshop.room ?? '',
    roomLayoutUrl: workshop.roomLayoutUrl ?? '',
    startTime: toLocalInput(workshop.startTime),
    endTime: toLocalInput(workshop.endTime),
    capacity: String(workshop.capacity ?? 1),
    price: String(Number(workshop.price ?? 0)),
    pdfUrl: workshop.pdfUrl ?? '',
  };
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

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeNumericValue(value) {
  if (!value) return '0';
  return String(Number(value));
}

function getWorkshopFormError(form) {
  if (!form?.title?.trim() || !form?.room?.trim() || !form?.startTime || !form?.endTime) {
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

function statusStyle(status) {
  const styles = {
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300',
  };
  return styles[status] ?? styles.DRAFT;
}

function workshopStatusLabel(status) {
  const labels = {
    DRAFT: 'Nháp',
    PUBLISHED: 'Đã xuất bản',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] ?? status;
}

function aiSummaryStatusLabel(status) {
  const labels = {
    NONE: 'Chưa có (tải PDF để tạo)',
    PROCESSING: 'Đang xử lý',
    DONE: 'Hoàn tất',
    FAILED: 'Thất bại',
  };
  return labels[status] ?? status;
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function formatFileSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function uploadNoticeClass(tone) {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  return classes[tone] ?? classes.info;
}

function getDateTimeMin() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

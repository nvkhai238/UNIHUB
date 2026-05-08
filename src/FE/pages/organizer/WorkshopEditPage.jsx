import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/api';

export default function WorkshopEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [workshopStatus, setWorkshopStatus] = useState('');
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
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

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setActionMsg('');
    try {
      await api.put(`/api/workshops/${id}`, toPayload(form));
      setActionMsg('Lưu thay đổi thành công.');
    } catch {
      setError('Không cập nhật được workshop.');
    }
  };

  const changeStatus = async (targetStatus) => {
    setError('');
    setActionMsg('');
    try {
      await api.patch(`/api/workshops/${id}/status`, { status: targetStatus });
      setWorkshopStatus(targetStatus);
      setActionMsg(`Trạng thái đã chuyển sang ${targetStatus}.`);
    } catch (err) {
      setError(err?.response?.data?.message || `Không đổi được trạng thái thành ${targetStatus}.`);
    }
  };

  const uploadPdf = async (file) => {
    if (!file) return;
    setUploadingPdf(true);
    setUploadMessage('');
    try {
      const payload = new FormData();
      payload.append('file', file);
      const { data } = await api.post(`/api/workshops/${id}/pdf`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadMessage('PDF đã tải lên, AI summary đang xử lý nền.');
      setForm((prev) => ({ ...prev, pdfUrl: data.data ?? prev.pdfUrl }));
      setAiSummary('');
      setAiSummaryStatus('PROCESSING');
    } catch {
      setUploadMessage('Không tải được PDF. Vui lòng thử lại.');
    } finally {
      setUploadingPdf(false);
    }
  };

  if (!form) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">{error || 'Đang tải workshop...'}</p>
      </section>
    );
  }

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const statusStyle = {
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-normal">Chỉnh sửa Workshop</h1>
        {workshopStatus && (
          <span className={`rounded-md border px-3 py-1 text-sm font-semibold ${statusStyle[workshopStatus] ?? ''}`}>
            {workshopStatus}
          </span>
        )}
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {uploadMessage && <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{uploadMessage}</div>}
      {actionMsg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{actionMsg}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {workshopStatus === 'DRAFT' && (
          <button
            type="button"
            onClick={() => changeStatus('PUBLISHED')}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Publish workshop
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
        <Field label="Tiêu đề" value={form.title} onChange={(v) => update('title', v)} required />
        <Field label="Diễn giả" value={form.speakerName} onChange={(v) => update('speakerName', v)} />
        <Field label="Phòng" value={form.room} onChange={(v) => update('room', v)} required />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Bắt đầu" type="datetime-local" value={form.startTime} onChange={(v) => update('startTime', v)} required />
          <Field label="Kết thúc" type="datetime-local" value={form.endTime} onChange={(v) => update('endTime', v)} required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sức chứa" type="number" value={form.capacity} onChange={(v) => update('capacity', Number(v))} required />
          <Field label="Giá vé (VNĐ)" type="number" value={form.price} onChange={(v) => update('price', Number(v))} required />
        </div>
        <Textarea label="Mô tả" value={form.description} onChange={(v) => update('description', v)} />
        <Textarea label="Bio diễn giả" value={form.speakerBio} onChange={(v) => update('speakerBio', v)} />
        <Field label="URL sơ đồ phòng" value={form.roomLayoutUrl} onChange={(v) => update('roomLayoutUrl', v)} />
        <label className="text-sm font-semibold text-gray-700">
          Upload PDF tài liệu
          <input
            type="file"
            accept="application/pdf"
            disabled={uploadingPdf}
            onChange={(e) => uploadPdf(e.target.files?.[0])}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
          />
        </label>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">AI Summary</p>
          <p className={`mt-1 text-sm font-semibold ${
            aiSummaryStatus === 'PROCESSING' ? 'text-blue-600' :
            aiSummaryStatus === 'FAILED' ? 'text-red-600' :
            'text-gray-950'
          }`}>
            {aiSummaryStatus === 'NONE' ? 'Chưa có (upload PDF để tạo)' : aiSummaryStatus}
          </p>
          {aiSummary && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{aiSummary}</p>
          )}
          {aiSummaryStatus === 'PROCESSING' && (
            <p className="mt-2 text-sm text-blue-600">AI đang xử lý PDF, tóm tắt sẽ hiển thị sau vài phút.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={workshopStatus === 'CANCELLED'}
            className="rounded-md bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
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
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input
        type={type}
        value={value ?? ''}
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
    capacity: workshop.capacity ?? 1,
    price: workshop.price ?? 0,
    pdfUrl: workshop.pdfUrl ?? '',
  };
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

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

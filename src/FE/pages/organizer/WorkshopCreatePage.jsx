import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';

const initialForm = {
  title: '',
  description: '',
  speakerName: '',
  speakerBio: '',
  room: '',
  startTime: '',
  endTime: '',
  capacity: 30,
  price: 0,
};

export default function WorkshopCreatePage() {
  const [form, setForm] = useState(initialForm);
  const [pdfFile, setPdfFile] = useState(null);
  const [roomLayoutFile, setRoomLayoutFile] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  // AI summary state — populated after workshop is created and PDF uploaded
  const [createdWorkshopId, setCreatedWorkshopId] = useState(null);
  const [aiSummaryStatus, setAiSummaryStatus] = useState('NONE');
  const [aiSummary, setAiSummary] = useState('');
  const navigate = useNavigate();

  // Poll AI summary status while PROCESSING
  useEffect(() => {
    if (!createdWorkshopId || aiSummaryStatus !== 'PROCESSING') return;
    const interval = setInterval(() => {
      api
        .get(`/api/workshops/${createdWorkshopId}/ai-summary/status`)
        .then(({ data }) => {
          const next = data.data?.aiSummaryStatus ?? 'NONE';
          if (next !== 'PROCESSING') {
            setAiSummaryStatus(next);
            setAiSummary(data.data?.aiSummary ?? '');
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [createdWorkshopId, aiSummaryStatus]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    setUploadStatus('Đang tạo workshop...');
    setAiSummaryStatus('NONE');
    setAiSummary('');
    setCreatedWorkshopId(null);

    try {
      const { data } = await api.post('/api/workshops', toPayload(form));
      const workshopId = data.data.id;
      setCreatedWorkshopId(workshopId);

      if (pdfFile) {
        setUploadStatus('Đang tải lên tài liệu PDF...');
        const pdfPayload = new FormData();
        pdfPayload.append('file', pdfFile);
        const { data: pdfData } = await api.post(`/api/workshops/${workshopId}/pdf`, pdfPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAiSummaryStatus(pdfData.data?.aiSummaryStatus ?? 'PROCESSING');
      }

      if (roomLayoutFile) {
        setUploadStatus('Đang tải lên sơ đồ phòng...');
        const imgPayload = new FormData();
        imgPayload.append('file', roomLayoutFile);
        await api.post(`/api/workshops/${workshopId}/room-layout`, imgPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setUploadStatus('Workshop đã được tạo thành công!');
      setIsSubmitting(false);
      // Don't navigate immediately — let admin see the AI summary result first
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tạo được workshop. Kiểm tra lại dữ liệu nhập.');
      setIsSubmitting(false);
      setUploadStatus('');
    }
  };

  const isDone = uploadStatus === 'Workshop đã được tạo thành công!';

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-normal">Tạo workshop mới</h1>
      <p className="mt-2 text-sm text-gray-600">Workshop mới tạo sẽ ở trạng thái nháp để ban tổ chức kiểm tra trước khi xuất bản.</p>
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {uploadStatus && (
        <div className={`mt-4 rounded-lg border p-4 text-sm font-semibold ${isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          {uploadStatus}
        </div>
      )}
      <WorkshopForm
        form={form}
        setForm={setForm}
        pdfFile={pdfFile}
        setPdfFile={setPdfFile}
        roomLayoutFile={roomLayoutFile}
        setRoomLayoutFile={setRoomLayoutFile}
        submit={submit}
        isSubmitting={isSubmitting}
        submitText="Tạo workshop"
        isDone={isDone}
        aiSummaryStatus={aiSummaryStatus}
        aiSummary={aiSummary}
        onNavigate={() => navigate('/admin/workshops')}
      />
    </section>
  );
}

function WorkshopForm({
  form, setForm, pdfFile, setPdfFile, roomLayoutFile, setRoomLayoutFile,
  submit, isSubmitting, submitText, isDone, aiSummaryStatus, aiSummary, onNavigate,
}) {
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <Field label="Tiêu đề" value={form.title} onChange={(v) => update('title', v)} required />
      <Field label="Diễn giả" value={form.speakerName} onChange={(v) => update('speakerName', v)} />
      <Field label="Phòng" value={form.room} onChange={(v) => update('room', v)} required />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Bắt đầu" type="datetime-local" value={form.startTime} onChange={(v) => update('startTime', v)} required />
        <Field label="Kết thúc" type="datetime-local" value={form.endTime} onChange={(v) => update('endTime', v)} required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Sức chứa" type="number" value={form.capacity} onChange={(v) => update('capacity', Number(v))} required />
        <Field label="Giá vé" type="number" value={form.price} onChange={(v) => update('price', Number(v))} required />
      </div>
      <Textarea label="Mô tả" value={form.description} onChange={(v) => update('description', v)} />
      <Textarea label="Bio diễn giả" value={form.speakerBio} onChange={(v) => update('speakerBio', v)} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-gray-700">
          Sơ đồ phòng (Ảnh)
          <input
            type="file"
            accept="image/*"
            disabled={isSubmitting || isDone}
            onChange={(e) => setRoomLayoutFile(e.target.files?.[0])}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
          />
          {roomLayoutFile && <p className="mt-1 text-xs text-emerald-600">Đã chọn: {roomLayoutFile.name}</p>}
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Tài liệu PDF (Tự động tóm tắt AI)
          <input
            type="file"
            accept="application/pdf"
            disabled={isSubmitting || isDone}
            onChange={(e) => setPdfFile(e.target.files?.[0])}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
          />
          {pdfFile && <p className="mt-1 text-xs text-emerald-600">Đã chọn: {pdfFile.name}</p>}
        </label>
      </div>

      {/* AI Summary preview — shown after PDF is uploaded during create flow */}
      {aiSummaryStatus !== 'NONE' && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Tóm tắt AI</p>
          <p className={`mt-1 text-sm font-semibold ${
            aiSummaryStatus === 'PROCESSING' ? 'text-blue-600'
            : aiSummaryStatus === 'FAILED' ? 'text-red-600'
            : 'text-green-600'
          }`}>
            {aiSummaryStatus === 'PROCESSING' ? 'Đang xử lý...'
              : aiSummaryStatus === 'DONE' ? 'Hoàn tất'
              : 'Thất bại'}
          </p>
          {aiSummaryStatus === 'PROCESSING' && (
            <p className="mt-2 text-sm text-blue-600">AI đang đọc và tóm tắt tài liệu PDF, vui lòng chờ vài giây...</p>
          )}
          {aiSummary && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{aiSummary}</p>
          )}
          {aiSummaryStatus === 'FAILED' && (
            <p className="mt-2 text-sm text-red-600">Tóm tắt thất bại. Bạn có thể thử lại trong trang chỉnh sửa workshop.</p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {!isDone ? (
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang xử lý...' : submitText}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNavigate}
            className="mt-4 rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Xem danh sách workshop
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
    </label>
  );
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

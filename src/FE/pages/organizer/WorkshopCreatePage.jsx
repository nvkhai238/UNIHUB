import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function WorkshopCreatePage() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/api/workshops', toPayload(form));
      navigate('/admin/workshops');
    } catch {
      setError('Không tạo được workshop. Kiểm tra lại dữ liệu nhập.');
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-normal">Tạo workshop mới</h1>
      <p className="mt-2 text-sm text-gray-600">Workshop mới tạo sẽ ở trạng thái nháp để ban tổ chức kiểm tra trước khi xuất bản.</p>
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <WorkshopForm form={form} setForm={setForm} submit={submit} submitText="Tạo workshop" />
    </section>
  );
}

function WorkshopForm({ form, setForm, submit, submitText }) {
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
      <Field label="URL sơ đồ phòng" value={form.roomLayoutUrl} onChange={(v) => update('roomLayoutUrl', v)} />
      <Field label="URL tài liệu PDF" value={form.pdfUrl} onChange={(v) => update('pdfUrl', v)} />
      <button type="submit" className="rounded-md bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700">
        {submitText}
      </button>
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

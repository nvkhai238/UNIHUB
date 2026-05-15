import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/api';
import { formatDateTime } from '../../utils/dateTime';

function createEmptyForm() {
  return {
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    proofUrl: '',
    proofNote: '',
  };
}

export default function StudentRefundRequestPage() {
  const { registrationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(createEmptyForm());

  const load = () => {
    setLoading(true);
    setError('');
    api.get(`/api/refunds/my/registrations/${registrationId}`)
      .then(({ data }) => {
        const payload = data.data;
        setData(payload);
        setForm({
          bankName: payload.bankName || '',
          bankAccountName: payload.bankAccountName || '',
          bankAccountNumber: payload.bankAccountNumber || '',
          proofUrl: payload.proofUrl || '',
          proofNote: payload.proofNote || '',
        });
      })
      .catch((err) => setError(err?.response?.data?.message || 'Không tải được form hoàn tiền.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [registrationId]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const { data } = await api.post(`/api/refunds/my/registrations/${registrationId}`, form);
      const payload = data.data;
      setData(payload);
      setForm({
        bankName: payload.bankName || '',
        bankAccountName: payload.bankAccountName || '',
        bankAccountNumber: payload.bankAccountNumber || '',
        proofUrl: payload.proofUrl || '',
        proofNote: payload.proofNote || '',
      });
      setNotice('Đã gửi thông tin hoàn tiền thành công.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể lưu thông tin hoàn tiền lúc này.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">Đang tải form hoàn tiền...</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      </section>
    );
  }

  const processed = Boolean(data?.processed);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/student/registrations" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
        Quay lại đăng ký của tôi
      </Link>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-normal text-gray-950">Thông tin hoàn tiền</h1>
        <p className="mt-2 text-sm text-gray-600">
          Điền chính xác thông tin tài khoản và link minh chứng để ban tổ chức xử lý hoàn tiền cho workshop bị hủy.
        </p>

        {notice && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
          <Info label="Workshop" value={data?.workshopTitle} />
          <Info label="Mã thanh toán" value={data?.paymentCode} />
          <Info label="Số tiền" value={formatMoney(data?.amount)} />
          <Info
            label="Trạng thái"
            value={processed
              ? `Đã hoàn lúc ${formatDate(data?.processedAt)}`
              : data?.submitted
                ? 'Đã gửi form, đang chờ ban tổ chức xử lý'
                : 'Chưa gửi form'}
          />
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <Field label="Tên ngân hàng" value={form.bankName} onChange={(value) => update('bankName', value)} disabled={processed} required />
          <Field label="Tên chủ tài khoản" value={form.bankAccountName} onChange={(value) => update('bankAccountName', value)} disabled={processed} required />
          <Field label="Số tài khoản" value={form.bankAccountNumber} onChange={(value) => update('bankAccountNumber', value)} disabled={processed} required />
          <Field label="Link minh chứng thanh toán" value={form.proofUrl} onChange={(value) => update('proofUrl', value)} disabled={processed} required />
          <Textarea label="Ghi chú thêm" value={form.proofNote} onChange={(value) => update('proofNote', value)} disabled={processed} />

          {!processed && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Đang gửi...' : data?.submitted ? 'Cập nhật thông tin' : 'Gửi thông tin hoàn tiền'}
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, disabled = false, required = false }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <input
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, disabled = false }) {
  return (
    <label className="text-sm font-semibold text-gray-700">
      {label}
      <textarea
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
      />
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value || '-'}</p>
    </div>
  );
}

function formatMoney(value) {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function formatDate(value) {
  return formatDateTime(value, '-');
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = (unreadOnly = false) => {
    setLoading(true);
    api.get('/api/notifications', { params: { unreadOnly: unreadOnly || undefined } })
      .then(({ data }) => {
        setNotifications(data.data?.content ?? []);
        setUnreadCount(data.data?.unreadCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter === 'unread'); }, [filter]);

  const markRead = async (id) => {
    await api.patch(`/api/notifications/${id}`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.patch('/api/notifications', { action: 'mark_all_read' });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id) => {
    await api.delete(`/api/notifications/${id}`);
    const n = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(x => x.id !== id));
    if (n && !n.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const typeLabel = (type) => {
    const map = {
      REGISTRATION_CONFIRMED: 'Đăng ký',
      REGISTRATION_PENDING: 'Đăng ký',
      REGISTRATION_CANCELLED: 'Hủy',
      WORKSHOP_CANCELLED: 'Hủy',
      WORKSHOP_UPDATED: 'Cập nhật',
      PAYMENT_SUCCESS: 'Thanh toán',
      PAYMENT_FAILED: 'Thanh toán',
      CHECKIN_SUCCESS: 'Check-in',
      REMINDER: 'Nhắc nhở',
    };
    return map[type] ?? type;
  };

  const typeColor = (type) => {
    const map = {
      REGISTRATION_CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      REGISTRATION_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      REGISTRATION_CANCELLED: 'bg-gray-50 text-gray-600 border-gray-200',
      WORKSHOP_CANCELLED: 'bg-red-50 text-red-700 border-red-200',
      WORKSHOP_UPDATED: 'bg-blue-50 text-blue-700 border-blue-200',
      PAYMENT_SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      PAYMENT_FAILED: 'bg-red-50 text-red-700 border-red-200',
      CHECKIN_SUCCESS: 'bg-purple-50 text-purple-700 border-purple-200',
      REMINDER: 'bg-sky-50 text-sky-700 border-sky-200',
    };
    return map[type] ?? 'bg-gray-50 text-gray-600 border-gray-200';
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Thông báo</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-200 bg-white text-sm">
            <button
              className={`px-3 py-2 ${filter === 'all' ? 'bg-gray-100 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setFilter('all')}
            >Tất cả</button>
            <button
              className={`px-3 py-2 ${filter === 'unread' ? 'bg-gray-100 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setFilter('unread')}
            >Chưa đọc</button>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-500 py-12">Đang tải thông báo...</p>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <div className="mb-3 text-4xl">🔔</div>
          <p className="text-sm text-gray-500">
            {filter === 'unread' ? 'Không có thông báo chưa đọc.' : 'Chưa có thông báo nào.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`relative flex gap-3 rounded-lg border p-4 transition ${n.isRead
                  ? 'border-gray-100 bg-white'
                  : 'border-emerald-200 bg-emerald-50/50'
                }`}
            >
              <div className={`mt-1 shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${typeColor(n.type)}`}>
                {typeLabel(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${n.isRead ? 'text-gray-600' : 'font-semibold text-gray-950'}`}>{n.title}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-xs text-emerald-600 hover:text-emerald-800"
                      >Đánh dấu đã đọc</button>
                    )}
                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >✕</button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-500">{n.body}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDate(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

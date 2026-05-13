import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';
import { useNotificationContext } from '../../components/NotificationProvider';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const { unreadCount, setUnreadCount } = useNotificationContext();
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

  useEffect(() => {
    const handleIncomingNotification = (event) => {
      const incoming = event.detail;
      if (!incoming) return;

      setNotifications((prev) => {
        const exists = prev.some((item) => item.id === incoming.id);
        if (exists) return prev;
        if (filter === 'unread') {
          return [{ ...incoming, isRead: false }, ...prev];
        }
        return [{ ...incoming, isRead: false }, ...prev];
      });
    };

    window.addEventListener('unihub:notification', handleIncomingNotification);
    return () => window.removeEventListener('unihub:notification', handleIncomingNotification);
  }, [filter]);

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

  const deleteAllNotifications = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tất cả thông báo? Hành động này không thể hoàn tác.')) return;
    await api.delete('/api/notifications', { data: { action: 'delete_all' } });
    setNotifications([]);
    setUnreadCount(0);
  };

  const typeConfig = (type) => {
    const map = {
      REGISTRATION_CONFIRMED: {
        label: 'Đăng ký thành công',
        icon: '✅',
        badgeCls: 'bg-emerald-100 text-emerald-700',
        iconBg: 'bg-emerald-100',
      },
      REGISTRATION_PENDING: {
        label: 'Chờ xác nhận',
        icon: '⏳',
        badgeCls: 'bg-amber-100 text-amber-700',
        iconBg: 'bg-amber-100',
      },
      REGISTRATION_CANCELLED: {
        label: 'Đã hủy đăng ký',
        icon: '🚫',
        badgeCls: 'bg-gray-100 text-gray-600',
        iconBg: 'bg-gray-100',
      },
      WORKSHOP_CANCELLED: {
        label: 'Workshop bị hủy',
        icon: '❌',
        badgeCls: 'bg-red-100 text-red-700',
        iconBg: 'bg-red-100',
      },
      WORKSHOP_UPDATED: {
        label: 'Cập nhật workshop',
        icon: '📝',
        badgeCls: 'bg-blue-100 text-blue-700',
        iconBg: 'bg-blue-100',
      },
      PAYMENT_SUCCESS: {
        label: 'Thanh toán thành công',
        icon: '💳',
        badgeCls: 'bg-emerald-100 text-emerald-700',
        iconBg: 'bg-emerald-100',
      },
      PAYMENT_FAILED: {
        label: 'Thanh toán thất bại',
        icon: '💳',
        badgeCls: 'bg-red-100 text-red-700',
        iconBg: 'bg-red-100',
      },
      PAYMENT_PENDING: {
        label: 'Chờ thanh toán',
        icon: '💳',
        badgeCls: 'bg-amber-100 text-amber-700',
        iconBg: 'bg-amber-100',
      },
      CHECKIN_SUCCESS: {
        label: 'Check-in thành công',
        icon: '📍',
        badgeCls: 'bg-purple-100 text-purple-700',
        iconBg: 'bg-purple-100',
      },
      REMINDER: {
        label: 'Nhắc nhở',
        icon: '🔔',
        badgeCls: 'bg-sky-100 text-sky-700',
        iconBg: 'bg-sky-100',
      },
      WAITLIST_PROMOTED: {
        label: 'Đã được xác nhận',
        icon: '🎉',
        badgeCls: 'bg-emerald-100 text-emerald-700',
        iconBg: 'bg-emerald-100',
      },
    };
    return map[type] ?? {
      label: type?.replace(/_/g, ' ') ?? 'Thông báo',
      icon: '🔔',
      badgeCls: 'bg-gray-100 text-gray-600',
      iconBg: 'bg-gray-100',
    };
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Thông báo</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white text-sm overflow-hidden">
            {['all', 'unread'].map((f) => (
              <button
                key={f}
                className={`px-4 py-2 font-medium transition-colors ${
                  filter === f
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Tất cả' : 'Chưa đọc'}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Đánh dấu tất cả đã đọc
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={deleteAllNotifications}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
              title="Xóa tất cả thông báo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="mt-3 text-sm text-gray-500">Đang tải thông báo...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
          <div className="mb-3 text-5xl">🔔</div>
          <p className="text-gray-600 font-medium">
            {filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
          </p>
          <p className="mt-1 text-sm text-gray-400">Các thông báo mới sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const cfg = typeConfig(n.type);
            return (
              <div
                key={n.id}
                className={`group relative flex gap-4 rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${
                  n.isRead
                    ? 'border-gray-100 bg-white'
                    : 'border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white'
                }`}
              >
                {/* Unread indicator dot */}
                {!n.isRead && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-emerald-500" />
                )}

                {/* Icon */}
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${cfg.iconBg}`}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cfg.badgeCls}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                      </div>
                      <p className={`text-sm leading-relaxed ${n.isRead ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">{n.body}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Đánh dấu đã đọc"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Xóa thông báo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatRelativeTime(value) {
  if (!value) return '';
  const now = Date.now();
  const date = new Date(value);
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

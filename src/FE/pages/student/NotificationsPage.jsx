import { useEffect, useState } from 'react';
import api from '../../api/api';
import PaginationControls from '../../components/PaginationControls';
import { useNotificationContext } from '../../components/NotificationProvider';
import { formatDateTime } from '../../utils/dateTime';

const PAGE_SIZE = 12;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { unreadCount, setUnreadCount } = useNotificationContext();

  const load = (nextPage = page, nextFilter = filter) => {
    setLoading(true);
    api.get('/api/notifications', {
      params: {
        page: nextPage,
        size: PAGE_SIZE,
        unreadOnly: nextFilter === 'unread' ? true : undefined,
      },
    })
      .then(({ data }) => {
        setNotifications(data.data?.content ?? []);
        setUnreadCount(data.data?.unreadCount ?? 0);
        setTotalPages(data.data?.totalPages ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page, filter);
  }, [page, filter]);

  useEffect(() => {
    const handleIncomingNotification = (event) => {
      const incoming = event.detail;
      if (!incoming || page !== 0) {
        return;
      }

      setNotifications((prev) => {
        const exists = prev.some((item) => item.id === incoming.id);
        if (exists) return prev;
        const next = [{ ...incoming, isRead: false }, ...prev];
        return next.slice(0, PAGE_SIZE);
      });
    };

    window.addEventListener('unihub:notification', handleIncomingNotification);
    return () => window.removeEventListener('unihub:notification', handleIncomingNotification);
  }, [page]);

  const markRead = async (id) => {
    await api.patch(`/api/notifications/${id}`);
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.patch('/api/notifications', { action: 'mark_all_read' });
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id) => {
    await api.delete(`/api/notifications/${id}`);
    const target = notifications.find((item) => item.id === id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const deleteAllNotifications = async () => {
    if (!window.confirm('Ban co chac chan muon xoa tat ca thong bao?')) {
      return;
    }
    await api.delete('/api/notifications', { data: { action: 'delete_all' } });
    setNotifications([]);
    setUnreadCount(0);
    setTotalPages(0);
  };

  const handleFilterChange = (nextFilter) => {
    setPage(0);
    setFilter(nextFilter);
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Thong bao</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} thong bao chua doc` : 'Tat ca da duoc doc'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white text-sm">
            {['all', 'unread'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleFilterChange(item)}
                className={`px-4 py-2 font-medium transition-colors ${
                  filter === item ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item === 'all' ? 'Tat ca' : 'Chua doc'}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Danh dau tat ca da doc
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={deleteAllNotifications}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
            >
              Xoa tat ca
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="mt-3 text-sm text-gray-500">Dang tai thong bao...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
          <div className="mb-3 text-5xl">🔔</div>
          <p className="font-medium text-gray-600">
            {filter === 'unread' ? 'Khong co thong bao chua doc' : 'Chua co thong bao nao'}
          </p>
          <p className="mt-1 text-sm text-gray-400">Cac thong bao moi se xuat hien tai day.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {notifications.map((notification) => {
              const config = typeConfig(notification.type);

              return (
                <div
                  key={notification.id}
                  className={`group relative flex gap-4 rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${
                    notification.isRead
                      ? 'border-gray-100 bg-white'
                      : 'border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white'
                  }`}
                >
                  {!notification.isRead && (
                    <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-500" />
                  )}

                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${config.iconBg}`}>
                    {config.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${config.badgeCls}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-gray-400">{formatRelativeTime(notification.createdAt)}</span>
                        </div>
                        <p className={`text-sm leading-relaxed ${notification.isRead ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-gray-500">{notification.body}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {!notification.isRead && (
                          <button
                            type="button"
                            onClick={() => markRead(notification.id)}
                            className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                            title="Danh dau da doc"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteNotification(notification.id)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Xoa thong bao"
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

          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

function typeConfig(type) {
  const map = {
    REGISTRATION_CONFIRMED: {
      label: 'Dang ky thanh cong',
      icon: '✅',
      badgeCls: 'bg-emerald-100 text-emerald-700',
      iconBg: 'bg-emerald-100',
    },
    REGISTRATION_PENDING: {
      label: 'Cho xac nhan',
      icon: '⏳',
      badgeCls: 'bg-amber-100 text-amber-700',
      iconBg: 'bg-amber-100',
    },
    REGISTRATION_CANCELLED: {
      label: 'Da huy dang ky',
      icon: '🚫',
      badgeCls: 'bg-gray-100 text-gray-600',
      iconBg: 'bg-gray-100',
    },
    WORKSHOP_CANCELLED: {
      label: 'Workshop bi huy',
      icon: '❌',
      badgeCls: 'bg-red-100 text-red-700',
      iconBg: 'bg-red-100',
    },
    WORKSHOP_UPDATED: {
      label: 'Cap nhat workshop',
      icon: '📝',
      badgeCls: 'bg-blue-100 text-blue-700',
      iconBg: 'bg-blue-100',
    },
    PAYMENT_SUCCESS: {
      label: 'Thanh toan thanh cong',
      icon: '💳',
      badgeCls: 'bg-emerald-100 text-emerald-700',
      iconBg: 'bg-emerald-100',
    },
    PAYMENT_FAILED: {
      label: 'Thanh toan that bai',
      icon: '💳',
      badgeCls: 'bg-red-100 text-red-700',
      iconBg: 'bg-red-100',
    },
    PAYMENT_PENDING: {
      label: 'Cho thanh toan',
      icon: '💳',
      badgeCls: 'bg-amber-100 text-amber-700',
      iconBg: 'bg-amber-100',
    },
    CHECKIN_SUCCESS: {
      label: 'Check-in thanh cong',
      icon: '📍',
      badgeCls: 'bg-purple-100 text-purple-700',
      iconBg: 'bg-purple-100',
    },
    REMINDER: {
      label: 'Nhac nho',
      icon: '🔔',
      badgeCls: 'bg-sky-100 text-sky-700',
      iconBg: 'bg-sky-100',
    },
    WAITLIST_PROMOTED: {
      label: 'Da duoc xac nhan',
      icon: '🎉',
      badgeCls: 'bg-emerald-100 text-emerald-700',
      iconBg: 'bg-emerald-100',
    },
  };

  return map[type] ?? {
    label: type?.replace(/_/g, ' ') ?? 'Thong bao',
    icon: '🔔',
    badgeCls: 'bg-gray-100 text-gray-600',
    iconBg: 'bg-gray-100',
  };
}

function formatRelativeTime(value) {
  if (!value) return '';
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (diff < 60) return 'Vua xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phut truoc`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} gio truoc`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngay truoc`;
  return formatDateTime(value);
}

import { useSearchParams } from 'react-router-dom';

export default function TicketPage() {
  const [searchParams] = useSearchParams();
  
  const id = searchParams.get('id');
  const student = searchParams.get('s');
  const workshop = searchParams.get('w');
  const room = searchParams.get('r');
  const startTime = searchParams.get('t');

  if (!id) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Không tìm thấy vé</h1>
        <p className="mt-2 text-gray-600">Đường dẫn vé không hợp lệ hoặc bị thiếu thông tin.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md px-4 py-8">
      <div className="rounded-2xl border border-emerald-100 bg-white shadow-xl overflow-hidden">
        <div className="bg-emerald-600 p-6 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-600 mb-4">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Vé Điện Tử Hợp Lệ</h1>
          <p className="text-emerald-100 text-sm opacity-90 break-all">{id}</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Sinh viên</p>
            <p className="text-lg font-bold text-gray-900">{student}</p>
          </div>
          
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Workshop</p>
            <p className="font-medium text-gray-900 leading-snug">{workshop}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Phòng</p>
              <p className="font-medium text-gray-900">{room}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Thời gian</p>
              <p className="font-medium text-gray-900">{formatDate(startTime)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch(e) {
    return value;
  }
}

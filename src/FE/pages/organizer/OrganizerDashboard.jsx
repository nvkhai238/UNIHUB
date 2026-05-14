import { Link } from 'react-router-dom';

export default function OrganizerDashboard() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-normal">Tổng quan Ban tổ chức</h1>
        <p className="mt-2 text-sm text-gray-600">
          Quản lý workshop, theo dõi đăng ký, check-in và import sinh viên.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard
          title="Quản lý workshop"
          text="Xem danh sách, xuất bản hoặc hủy workshop."
          to="/admin/workshops"
        />
        <ActionCard
          title="Tạo workshop mới"
          text="Tạo lịch, phòng, số ghế và giá vé."
          to="/admin/workshops/create"
        />
        <ActionCard
          title="Thống kê"
          text="Theo dõi đăng ký, doanh thu và tỷ lệ check-in."
          to="/admin/statistics"
        />
        <ActionCard
          title="Import sinh viên"
          text="Chạy job CSV batch đồng bộ danh sách SV từ hệ thống cũ."
          to="/admin/student-imports"
        />
      </div>
    </section>
  );
}

function ActionCard({ title, text, to }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
    >
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
    </Link>
  );
}

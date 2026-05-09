import { Outlet } from 'react-router-dom';
import StudentHeader from '../components/StudentHeader';

/**
 * StudentLayout - layout danh rieng cho role STUDENT.
 *
 * Hien thi sau khi AuthGuard + RoleGuard xac thuc thanh cong.
 */
export default function StudentLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <StudentHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

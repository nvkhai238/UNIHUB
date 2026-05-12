import AppRouter from './router/index.jsx';
import { ToastProvider } from './components/Toast';
import { NotificationProvider } from './components/NotificationProvider';

export default function App() {
  return (
    <ToastProvider>
      <NotificationProvider>
        <AppRouter />
      </NotificationProvider>
    </ToastProvider>
  );
}

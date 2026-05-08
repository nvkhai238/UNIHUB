import AppRouter from './router/index.jsx';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  );
}

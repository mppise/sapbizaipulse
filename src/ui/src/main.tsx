import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import ApiKeyGate from './components/ApiKeyGate';
import { ToastProvider } from './components/ToastContainer';

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <ApiKeyGate>
      <App />
    </ApiKeyGate>
  </ToastProvider>,
);

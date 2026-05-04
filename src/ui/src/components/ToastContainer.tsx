import React, { createContext, useContext, useState, useCallback } from 'react';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'danger' | 'warning';
}

interface ToastContextValue {
  showToast: (message: string, variant?: Toast['variant']) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, variant: Toast['variant'] = 'danger') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="toast-container position-fixed bottom-0 end-0 p-3"
        style={{ zIndex: 1100 }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast show align-items-center text-bg-${t.variant} border-0 mb-2`}
            role="alert"
          >
            <div className="d-flex">
              <div className="toast-body">{t.message}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  return { toasts, showToast, removeToast };
};

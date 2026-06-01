import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastContext } from '../../context/ToastContext';

const ToastItem = ({ toast, removeToast }) => {
  const { id, message, type, duration } = toast;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  const config = {
    success: { icon: CheckCircle, bg: 'bg-green-500/20', border: 'border-green-500', iconColor: 'text-green-400', progressBg: 'bg-green-500' },
    error: { icon: XCircle, bg: 'bg-red-500/20', border: 'border-red-500', iconColor: 'text-red-400', progressBg: 'bg-red-500' },
    info: { icon: Info, bg: 'bg-blue-500/20', border: 'border-blue-500', iconColor: 'text-blue-400', progressBg: 'bg-blue-500' },
    warning: { icon: AlertTriangle, bg: 'bg-yellow-500/20', border: 'border-yellow-500', iconColor: 'text-yellow-400', progressBg: 'bg-yellow-500' },
  };

  const style = config[type] || config.info;
  const Icon = style.icon;

  return (
    <div className={`relative overflow-hidden mb-3 min-w-[300px] max-w-[400px] rounded-lg shadow-xl border ${style.border} ${style.bg} backdrop-blur-md animate-slide-in`}>
      <div className="flex items-start p-4 pr-10">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
        <p className="ml-3 text-sm font-medium text-white">{message}</p>
        <button 
          onClick={() => removeToast(id)}
          className="absolute right-3 top-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div 
        className={`absolute bottom-0 left-0 h-1 ${style.progressBg}`} 
        style={{ 
          animation: `shrink ${duration}ms linear forwards`
        }} 
      />
    </div>
  );
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastContext();
  
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
};

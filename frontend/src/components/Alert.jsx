import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

const Alert = ({ type = 'info', message, title, onClose }) => {
  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} className="alert-icon text-emerald-600" />;
      case 'error':
        return <AlertCircle size={20} className="alert-icon text-rose-600" />;
      case 'warning':
        return <AlertTriangle size={20} className="alert-icon text-amber-600" />;
      default:
        return <Info size={20} className="alert-icon text-cyan-600" />;
    }
  };

  return (
    <div className={`alert-box alert-${type}`} role="alert">
      <div className="alert-content">
        {getIcon()}
        <div>
          {title && <h4 className="alert-title">{title}</h4>}
          <p className="alert-message">{message}</p>
        </div>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="alert-close" aria-label="Close">
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;

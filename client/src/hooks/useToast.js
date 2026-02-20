import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/Toast'; //

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const idCounter = useRef(0);

    const addToast = useCallback((type, message, duration = 3000) => {
        const id = idCounter.current++;
        setToasts(currentToasts => [...currentToasts, { id, message, type, duration }]);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
    }, []);

    const success = useCallback((message, duration) => addToast('success', message, duration), [addToast]);
    const error = useCallback((message, duration) => addToast('error', message, duration), [addToast]);
    const warning = useCallback((message, duration) => addToast('warning', message, duration), [addToast]);
    const info = useCallback((message, duration) => addToast('info', message, duration), [addToast]);

    const value = { toasts, removeToast, success, error, warning, info };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Conteneur pour afficher les toasts au-dessus de l'application */}
            <div className="toast-container-wrapper" style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
            }}>
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        duration={toast.duration}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// client/src/hooks/useToast.js (Extrait final)

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    const showToast = (message, type = 'info') => {
        switch (type) {
            case 'success': context.success(message); break;
            case 'error': context.error(message); break;
            case 'warning': context.warning(message); break;
            default: context.info(message);
        }
    };

    return { ...context, showToast };
};
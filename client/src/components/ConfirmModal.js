// client/src/components/ConfirmModal.js
import React from 'react';
import './ConfirmModal.scss';

const ConfirmModal = ({
                          isOpen,
                          onClose,
                          onConfirm,
                          title = "Confirmer l'action",
                          message,
                          confirmText = "Confirmer",
                          cancelText = "Annuler",
                          type = "danger"
                      }) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="confirm-modal">
                <div className="confirm-modal-header">
                    <h3 className="confirm-modal-title">{title}</h3>
                </div>

                <div className="confirm-modal-body">
                    <div className={`confirm-icon confirm-icon-${type}`}>
                        {type === 'danger' ? '' : 'ℹ️'}
                    </div>
                    <p className="confirm-message">{message}</p>
                </div>

                <div className="confirm-modal-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`btn btn-${type}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;

// frontend/src/components/ScheduleManager.js
import React, { useState } from 'react';
import { useScheduleHours } from '../../../hooks/useScheduleHours';
import './ScheduleManager.scss';

const ScheduleManager = () => {
    const {
        hours,
        loading,
        error,
        addHour,
        updateHour,
        removeHour,
        getSortedHours
    } = useScheduleHours();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState({
        id: null,
        libelle: '',
        isEdit: false
    });
    const [validationError, setValidationError] = useState('');

    // Validation du format HH:MM-HH:MM
    const validateTimeSlot = (timeSlot) => {
        const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!regex.test(timeSlot)) {
            return "Format invalide. Utilisez HH:MM-HH:MM";
        }

        const [start, end] = timeSlot.split('-');
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        if (startTime >= endTime) {
            return "L'heure de fin doit être après l'heure de début";
        }

        return null;
    };

    // Ouvrir modal pour ajouter
    const handleAdd = () => {
        setModalData({
            id: null,
            libelle: '',
            isEdit: false
        });
        setValidationError('');
        setIsModalOpen(true);
    };

    // Ouvrir modal pour éditer
    const handleEdit = (hour) => {
        setModalData({
            id: hour.id,
            libelle: hour.libelle,
            isEdit: true
        });
        setValidationError('');
        setIsModalOpen(true);
    };

    // Fermer modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setModalData({ id: null, libelle: '', isEdit: false });
        setValidationError('');
    };

    // Sauvegarder (ajouter ou modifier)
    const handleSave = async (e) => {
        e.preventDefault();

        const trimmedLibelle = modalData.libelle.trim();

        // Validation
        const validationErr = validateTimeSlot(trimmedLibelle);
        if (validationErr) {
            setValidationError(validationErr);
            return;
        }

        try {
            if (modalData.isEdit) {
                await updateHour(modalData.id, { libelle: trimmedLibelle });
            } else {
                await addHour({ libelle: trimmedLibelle });
            }
            handleCloseModal();
        } catch (error) {
            setValidationError(error.message || 'Erreur lors de la sauvegarde');
        }
    };

    // Supprimer un créneau
    const handleDelete = async (hour) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le créneau "${hour.libelle}" ?`)) {
            try {
                await removeHour(hour.id);
            } catch (error) {
                alert('Erreur lors de la suppression: ' + error.message);
            }
        }
    };

    // Calculer la durée d'un créneau
    const getSlotDuration = (libelle) => {
        const [start, end] = libelle.split('-');
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return endTime - startTime;
    };

    if (loading) {
        return (
            <div className="settings-section">
                <h2>⏰ Horaire</h2>
                <div className="loading-message">
                    Chargement des créneaux horaires...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="settings-section">
                <h2>⏰ Horaire</h2>
                <div className="error-message">
                    Erreur: {error}
                </div>
            </div>
        );
    }
    const sortedHours = hours.sort((a, b) => a.libelle.localeCompare(b.libelle));

    return (
        <div className="settings-section">
            <h2>⏰ Gestion de l'Horaire</h2>
            <p>Gestion des créneaux horaires de l'établissement</p>

            <button className="btn btn-primary" onClick={handleAdd}>
                ➕ Ajouter un créneau
            </button>

            <div className="schedule-manager">
                <div className="section-header">
                    <h3>Créneaux horaires ({hours.length})</h3>
                </div>

                {sortedHours.length === 0 ? (
                    <div className="no-data">
                        <p>Aucun créneau horaire configuré.</p>
                        <p>Cliquez sur "Ajouter un créneau" pour commencer.</p>
                    </div>
                ) : (
                    <div className="schedule-grid">
                        {sortedHours.map((hour, index) => (
                            <div key={hour.id} className="schedule-item">
                                <div className="schedule-info">
                                    <div className="schedule-number">
                                        #{index + 1}
                                    </div>
                                    <div className="schedule-details">
                                        <div className="schedule-time">
                                            {hour.libelle}
                                        </div>
                                        <div className="schedule-duration">
                                            {getSlotDuration(hour.libelle)} minutes
                                        </div>
                                    </div>
                                </div>
                                <div className="schedule-actions">
                                    <button
                                        className="btn btn-edit"
                                        onClick={() => handleEdit(hour)}
                                        title="Modifier"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="btn btn-delete"
                                        onClick={() => handleDelete(hour)}
                                        title="Supprimer"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal pour ajouter/éditer */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>
                                {modalData.isEdit ? 'Modifier le créneau' : 'Ajouter un créneau'}
                            </h3>
                            <button
                                className="modal-close"
                                onClick={handleCloseModal}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="class-form">
                            <div className="form-group">
                                <label htmlFor="libelle">
                                    Créneau horaire <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="libelle"
                                    value={modalData.libelle}
                                    onChange={(e) => setModalData(prev => ({
                                        ...prev,
                                        libelle: e.target.value
                                    }))}
                                    placeholder="Ex: 08:00-08:50"
                                    className={validationError ? 'error' : ''}
                                />
                                <small className="form-hint">
                                    Format: HH:MM-HH:MM (ex: 08:00-08:50)
                                </small>
                            </div>

                            {validationError && (
                                <div className="validation-error">
                                    {validationError}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleCloseModal}
                                >
                                    Annuler
                                </button>
                                <button type="submit" className="btn-primary">
                                    {modalData.isEdit ? '✏️ Modifier' : '➕ Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleManager;

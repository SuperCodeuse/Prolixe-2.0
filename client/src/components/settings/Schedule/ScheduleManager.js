// frontend/src/components/ScheduleManager.js
import React, { useState } from 'react';
import { useScheduleHours } from '../../../hooks/useScheduleHours';
import './ScheduleManager.scss';
import {Clock} from "lucide-react";

const ScheduleManager = () => {
    const { hours, loading, error, addHour, updateHour, removeHour } = useScheduleHours();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState({ id: null, libelle: '', isEdit: false });
    const [validationError, setValidationError] = useState('');

    const validateTimeSlot = (timeSlot) => {
        const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!regex.test(timeSlot)) return "Format invalide. Utilisez HH:MM-HH:MM";
        const [start, end] = timeSlot.split('-');
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        if ((startH * 60 + startM) >= (endH * 60 + endM)) return "L'heure de fin doit être après le début";
        return null;
    };

    const handleOpenModal = (hour = null) => {
        setModalData(hour
            ? { id: hour.id, libelle: hour.libelle, isEdit: true }
            : { id: null, libelle: '', isEdit: false }
        );
        setValidationError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const error = validateTimeSlot(modalData.libelle.trim());
        if (error) return setValidationError(error);

        try {
            if (modalData.isEdit) await updateHour(modalData.id, { libelle: modalData.libelle });
            else await addHour({ libelle: modalData.libelle });
            setIsModalOpen(false);
        } catch (err) { setValidationError(err.message); }
    };

    const getSlotDuration = (libelle) => {
        const [s, e] = libelle.split('-');
        const parse = (t) => { const [h, m] = t.split(':'); return h * 60 + parseInt(m); };
        return parse(e) - parse(s);
    };

    if (loading) return <div className="schedule-manager-container loading"><span>⏳ Chargement...</span></div>;

    const sortedHours = [...hours].sort((a, b) => a.libelle.localeCompare(b.libelle));

    return (
        <div className="schedule-manager-container">
            <header className="manager-header">
                <div className="title-wrapper">
                    <div>
                        <h2>
                            <Clock className="icon-lucid"/>
                            Gestion de l'Horaire
                        </h2>
                        <p>Configurez les créneaux de l'établissement</p>
                    </div>
                </div>
                <button className="add-glass-btn" onClick={() => handleOpenModal()}>
                    <span>+</span> Nouveau Créneau
                </button>
            </header>

            <div className="schedule-grid">
                {sortedHours.length === 0 ? (
                    <div className="empty-state">Aucun créneau configuré.</div>
                ) : (
                    sortedHours.map((hour, index) => (
                        <div key={hour.id} className="schedule-card">
                            <div className="card-index">#{index + 1}</div>
                            <div className="card-info">
                                <span className="time">{hour.libelle}</span>
                                <span className="duration">{getSlotDuration(hour.libelle)} min</span>
                            </div>
                            <div className="card-actions">
                                <button onClick={() => handleOpenModal(hour)} className="action-btn edit">✏️</button>
                                <button onClick={() => removeHour(hour.id)} className="action-btn delete">🗑️</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <div className="glass-modal-overlay">
                    <div className="glass-modal">
                        <h3>{modalData.isEdit ? 'Modifier' : 'Ajouter'} un créneau</h3>
                        <form onSubmit={handleSave}>
                            <div className="input-group">
                                <label>Heures (HH:MM-HH:MM)</label>
                                <input
                                    autoFocus
                                    placeholder="08:00-09:00"
                                    value={modalData.libelle}
                                    onChange={e => setModalData({...modalData, libelle: e.target.value})}
                                />
                                {validationError && <span className="error-text">{validationError}</span>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setIsModalOpen(false)}>Annuler</button>
                                <button type="submit" className="confirm-btn">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleManager;
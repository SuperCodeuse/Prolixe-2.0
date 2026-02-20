// ScheduleCreator.js
import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useToast} from '../../../hooks/useToast';
import useScheduleModel from '../../../hooks/useScheduleModel'; // Utilisation du nouveau hook
import './ScheduleCreator.scss';
import moment from 'moment';
import * as currentJournal from "date-fns/locale";

const ScheduleCreator = () => {
    const [scheduleForm, setScheduleForm] = useState({
        name: '',
        startDate: '',
        endDate: '',
    });
    const { success, error: showError } = useToast();
    const { createSchedule, loading } = useScheduleModel(currentJournal?.id);
    const navigate = useNavigate();


    const handleChange = (e) => {
        const { name, value } = e.target;
        setScheduleForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!scheduleForm.name || !scheduleForm.startDate || !scheduleForm.endDate) {
            showError("Veuillez remplir tous les champs du formulaire.");
            return;
        }

        const startMoment = moment(scheduleForm.startDate);
        const endMoment = moment(scheduleForm.endDate);

        if (startMoment.isAfter(endMoment)) {
            showError("La date de début doit être antérieure à la date de fin.");
            return;
        }

        try {
            await createSchedule(scheduleForm);
            success("Emploi du temps créé avec succès !");
            navigate('/settings');
        } catch (err) {
            console.error("Erreur lors de la création de l'emploi du temps:", err);
            showError(err.message || 'Erreur lors de la création de l\'emploi du temps');
        }
    };

    return (
        <div className="settings-section schedule-creator">
            <h2>Créer un nouvel emploi du temps</h2>
            <p>Remplissez les informations pour créer un nouvel emploi du temps.</p>

            <form onSubmit={handleSubmit} className="schedule-creator-form">
                <div className="form-group">
                    <label htmlFor="name">Nom de l'emploi du temps</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={scheduleForm.name}
                        onChange={handleChange}
                        placeholder="Ex: Emploi du temps 2024-2025"
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="startDate">Date de début</label>
                    <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={scheduleForm.startDate}
                        onChange={handleChange}
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="endDate">Date de fin</label>
                    <input
                        type="date"
                        id="endDate"
                        name="endDate"
                        value={scheduleForm.endDate}
                        onChange={handleChange}
                        disabled={loading}
                    />
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Création...' : 'Créer'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ScheduleCreator;
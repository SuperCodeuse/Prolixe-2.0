// client/src/hooks/useScheduleModel.js
import { useState, useEffect, useCallback } from 'react';
import ScheduleModelService from '../services/ScheduleModelService';

const useScheduleModel = (journalId) => { // On accepte journalId ici
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Utilisation de useCallback pour éviter de recréer la fonction à chaque rendu
    const fetchSchedules = useCallback(async () => {
        if (!journalId) return;

        setLoading(true);
        setError(null);
        try {
            const response = await ScheduleModelService.getSchedules(journalId);
            setSchedules(response.data.schedules);
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la récupération';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [journalId]); // Dépendance sur journalId

    const createSchedule = async (scheduleData) => {
        setLoading(true);
        setError(null);
        try {
            // On s'assure d'envoyer journalId aussi à la création si nécessaire
            await ScheduleModelService.createSchedule(
                scheduleData.name,
                scheduleData.startDate,
                scheduleData.endDate,
                //journalId // Ajoutez-le si votre API de création en a besoin
            );
            await fetchSchedules();
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la création';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Le useEffect se déclenche maintenant dès que journalId change
    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    return { schedules, loading, error, createSchedule, fetchSchedules };
};

export default useScheduleModel;
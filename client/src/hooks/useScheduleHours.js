// frontend/src/hooks/useScheduleHours.js
import {useState, useEffect, useCallback} from 'react';
import ScheduleHoursService from '../services/ScheduleHoursService';

export const useScheduleHours = () => {
    const [hours, setHours] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Charger les créneaux horaires
    const loadHours = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await ScheduleHoursService.getHours();
            setHours(response.data.data || []);

        } catch (err) {
            setError(err.message);
            console.error('Erreur chargement créneaux horaires:', err);
        } finally {
            setLoading(false);
        }
    };

    // Ajouter un créneau horaire
    const addHour = async (hourData) => {
        try {
            const response = await ScheduleHoursService.createHour(hourData);
            setHours(prev => [...prev, response.data]);
            return response.data;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Modifier un créneau horaire
    const updateHour = async (id, hourData) => {
        try {
            const response = await ScheduleHoursService.updateHour(id, hourData);
            setHours(prev => prev.map(hour =>
                hour.id === id ? response.data.data : hour
            ));
            return response.data;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Supprimer un créneau horaire
    const removeHour = async (id) => {
        try {
            await ScheduleHoursService.deleteHour(id);
            setHours(prev => prev.filter(hour => hour.id !== id));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // FONCTIONS UTILITAIRES POUR L'HORAIRE

    // Parser le libellé d'heure (ex: '08:25-09:15')
    const parseTimeSlot = (libelle) => {
        const [startTime, endTime] = libelle.split('-');
        return {
            start: startTime,
            end: endTime,
            duration: calculateDuration(startTime, endTime)
        };
    };

    // Calculer la durée en minutes
    const calculateDuration = (startTime, endTime) => {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        return endMinutes - startMinutes;
    };

    // Formater l'heure pour l'affichage (optionnel)
    const formatTimeSlot = (libelle) => {
        return libelle; // Déjà au bon format
    };

    // Valider le format d'un créneau horaire
    const validateTimeSlot = (libelle) => {
        const timeSlotRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeSlotRegex.test(libelle);
    };

    // Créer un libellé à partir d'heures de début et fin
    const createTimeSlotLabel = (startTime, endTime) => {
        return `${startTime}-${endTime}`;
    };

    // Trier les créneaux par heure de début
    const getSortedHours = () => {
        if (!Array.isArray(hours)) {
            return [];
        }

        return [...hours].sort((a, b) => {
            const aStart = a.libelle.split('-')[0];
            const bStart = b.libelle.split('-')[0];
            return aStart.localeCompare(bStart);
        });
    };

    // Obtenir les créneaux formatés pour l'horaire
    const getHoursForSchedule = () => {
        return getSortedHours().map(hour => ({
            ...hour,
            parsed: parseTimeSlot(hour.libelle),
            display: formatTimeSlot(hour.libelle)
        }));
    };

    const getHourIdByLibelle = useCallback((libelle) => {
        const hour = hours.find(h => h.libelle === libelle);
        return hour ? hour.id : null;
    }, [hours]);

    // Charger les créneaux au montage du composant
    useEffect(() => {
        loadHours().then();
    }, []);

    return {
        // Données
        hours,
        loading,
        error,

        // Actions CRUD
        loadHours,
        addHour,
        updateHour,
        removeHour,

        // Utilitaires
        parseTimeSlot,
        calculateDuration,
        formatTimeSlot,
        validateTimeSlot,
        createTimeSlotLabel,
        getSortedHours,
        getHoursForSchedule,
        getHourIdByLibelle
    };
};
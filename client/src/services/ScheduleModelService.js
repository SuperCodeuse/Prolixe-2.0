// client/src/services/ScheduleModelService.js
import apiClient from '../api/axiosConfig';

const ScheduleModelService = {
    /**
     * Crée un nouvel emploi du temps.
     * @param {string} name - Le nom de l'emploi du temps.
     * @param {string} startDate - La date de début au format YYYY-MM-DD.
     * @param {string} endDate - La date de fin au format YYYY-MM-DD.
     * @returns {Promise<object>} - L'objet de réponse de l'API.
     */
    createSchedule: (name, startDate, endDate) => {
        return apiClient.post('/schedules/', { name, startDate, endDate });
    },

    /**
     * Récupère tous les modèles d'emplois du temps.
     * @returns {Promise<object>} - L'objet de réponse de l'API contenant la liste des emplois du temps.
     */
    getSchedules: (journalId) => {
        return apiClient.get('/schedules/', {
            params: { journalId }
        });
    }
};

export default ScheduleModelService;
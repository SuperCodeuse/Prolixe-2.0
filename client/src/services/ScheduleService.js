// client/src/services/ScheduleService.js
import axios from '../api/axiosConfig';

const ScheduleService = {
    /**
     * Récupère tous les ensembles d'horaires (modèles) disponibles.
     * Note: La route backend est préfixée par /api/schedule dans axiosConfig ou app.use
     */
    getScheduleSets: async () => {
        // Suppression du 's' final sur /schedule pour correspondre à la route backend app.use('/api/schedule', ...)
        const response = await axios.get('/schedule/sets');
        return response.data;
    },

    /**
     * Crée un nouveau modèle d'emploi du temps (ex: "Horaire d'hiver")
     */
    createScheduleSet: async (name, journalId) => {
       return axios.post('/schedule/sets', { name, journal_id : journalId });
    },

    /**
     * Récupère les créneaux (slots) d'un horaire spécifique.
     * On passe le setId pour charger la grille correspondante.
     */
    getScheduleById: async (setId) => {
        const response = await axios.get(`/schedule/${setId}`);
        return response.data;
    },

    duplicateScheduleSet: async (setId, newName) => {
        const response = await axios.post(`/schedule/sets/${setId}/duplicate`, { newName });
        return response.data;
    },

    deleteScheduleSet: async (setId) => {
        const response = await axios.delete(`/schedule/sets/${setId}`);
        return response.data;
    },

    /**
     * Sauvegarde la grille complète pour un journal spécifique.
     * @param {number|string} setId - L'ID du modèle d'emploi du temps (schedule_set)
     * @param {Array} slots - Tableau d'objets { day, time_slot_id, subject, className, room }
     */
    saveSlots: async (setId, slots) => {
        const response = await axios.post('/schedule/slots/save', {
            schedule_set_id: setId,
            slots: slots
        });
        return response.data;
    }
};

export default ScheduleService;
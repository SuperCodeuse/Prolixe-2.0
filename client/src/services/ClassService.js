import apiClient from '../api/axiosConfig';

const ClassService = {
    /**
     * Récupère les classes rattachées à un journal spécifique.
     * Le contrôleur renvoie maintenant aussi le 'student_count' calculé.
     */
    getClasses: async (journal_id) => {
        if (!journal_id) return { data: { data: [] } };
        return await apiClient.get('/classes', { params: { journal_id } });
    },

    getClass: async (id) => {
        return await apiClient.get(`/classes/${id}`);
    },

    /**
     * @param {Object} classData - Doit contenir { name, level, journal_id }
     */
    createClass: async (classData) => {
        return await apiClient.post('/classes', classData);
    },

    /**
     * @param {Object} classData - Peut contenir { name, level }
     */
    updateClass: async (id, classData) => {
        return await apiClient.put(`/classes/${id}`, classData);
    },

    deleteClass: async (id) => {
        return await apiClient.delete(`/classes/${id}`);
    }
};

export default ClassService;
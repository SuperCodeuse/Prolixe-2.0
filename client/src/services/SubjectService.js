// client/src/services/SubjectService.js
import ApiService from '../api/axiosConfig';

const SUBJECT_API_URL = '/subjects'; // URL de base pour les matières

class SubjectService {
    /**
     * Récupère toutes les matières liées à un journal spécifique
     * @param {number|string} journalId
     */
    static async getSubjectsByJournal(journalId) {
        if (!journalId) {
            console.error("getSubjectsByJournal appelé sans journalId");
            return Promise.resolve({ data: { data: [], success: false } });
        }
        return ApiService.get(`${SUBJECT_API_URL}/journal/${journalId}`);
    }

    /**
     * Crée une nouvelle matière (nécessite name, color_code, journal_id)
     * @param {Object} data
     */
    static async createSubject(data) {
        return ApiService.post(`${SUBJECT_API_URL}/`, data);
    }

    /**
     * Met à jour une matière existante
     * @param {number|string} id
     * @param {Object} data
     */
    static async updateSubject(id, data) {
        return ApiService.put(`${SUBJECT_API_URL}/${id}`, data);
    }

    /**
     * Supprime une matière
     * @param {number|string} id
     */
    static async deleteSubject(id) {
        return ApiService.delete(`${SUBJECT_API_URL}/${id}`);
    }
}

export default SubjectService;
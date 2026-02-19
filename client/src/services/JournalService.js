import ApiService from '../api/axiosConfig';
const JOURNAL_API_URL = '/journal'; // Base URL pour les journaux

class JournalService {
    // --- Journal (Année scolaire) ---
    static async getAllJournals() {
        return ApiService.get(`${JOURNAL_API_URL}/`);
    }

    static async createJournal(data) {
        console.log("createJournal data:", data);
        return ApiService.post(`${JOURNAL_API_URL}/`, data);
    }

    static async archiveJournal(id) {
        return ApiService.post(`${JOURNAL_API_URL}/archive/${id}`);
    }

    static async deleteJournal(id) {
        return ApiService.delete(`${JOURNAL_API_URL}/delete/${id}`);
    }

    static async importJournal(file, journalId) {
        const formData = new FormData();
        formData.append('journalFile', file);
        formData.append('journal_id', journalId);

        // Axios gère automatiquement le Content-Type pour FormData
        return ApiService.post(`${JOURNAL_API_URL}/import`, formData);
    }

    static async getCurrentJournal() {
        return ApiService.get(`${JOURNAL_API_URL}/current`);
    }

    static async getArchivedJournals() {
        return ApiService.get(`${JOURNAL_API_URL}/archived`);
    }

    // --- Journal Entries ---
    static async getJournalEntries(startDate, endDate, journal_id) {
        return ApiService.get(`${JOURNAL_API_URL}/entries`, {
            params: { startDate, endDate, journal_id }
        });
    }

    static async upsertJournalEntry(entryData) {
        return ApiService.put(`${JOURNAL_API_URL}/entries`, entryData);
    }

    static async deleteJournalEntry(id) {
        return ApiService.delete(`${JOURNAL_API_URL}/entries/${id}`);
    }

    static async clearJournal(journalId) {
        return ApiService.delete(`${JOURNAL_API_URL}/entries/clear/${journalId}`);
    }

    static async getAssignments(journalId, classId = '', startDate = '', endDate = '') {
        if (!journalId) {
            console.error("getAssignments a été appelé sans journalId.");
            return Promise.resolve({ data: { data: [], success: false, message: 'Un ID de journal est requis.' } });
        }

        const params = { journal_id: journalId };
        if (classId) params.classId = classId;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        return ApiService.get(`${JOURNAL_API_URL}/assignments`, { params });
    }

    static async upsertAssignment(assignmentData) {
        return ApiService.put(`${JOURNAL_API_URL}/assignments`, assignmentData);
    }

    static async deleteAssignment(id) {
        return ApiService.delete(`${JOURNAL_API_URL}/assignments/${id}`);
    }
}

export default JournalService;
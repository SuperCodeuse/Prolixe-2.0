import ApiService from '../api/axiosConfig';

const API_BASE_URL = '/conseilDeClasse';

// --- Gestion des Sessions ---
export const getSessions = (journalId) =>
    ApiService.get(`${API_BASE_URL}/sessions/${journalId}`);

export const createSession = (journalId, libelle) =>
    ApiService.post(`${API_BASE_URL}/sessions`, { journal_id: journalId, libelle });

export const deleteSession = (id) =>
    ApiService.delete(`${API_BASE_URL}/sessions/${id}`);

// --- Gestion des Données Élèves ---
export const getConseilDataBySession = (sessionId, classId) =>
    ApiService.get(`${API_BASE_URL}/data/${sessionId}/${classId}`);

export const saveStudentConseil = (sessionId, studentId, data) =>
    ApiService.put(`${API_BASE_URL}/student/${sessionId}/${studentId}`, data);
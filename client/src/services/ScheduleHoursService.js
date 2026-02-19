import ApiService from '../api/axiosConfig';

class ScheduleHoursService {
    // Récupérer tous les créneaux horaires
    static async getHours() {
        return ApiService.request('/hours');
    }

    // Récupérer un créneau horaire spécifique
    static async getHour(id) { // Changé de getHours à getHour
        return ApiService.request(`/hours/${id}`);
    }

    // Créer un nouveau créneau horaire
    static async createHour(hourData) {
        return ApiService.request({
            url: '/hours',
            method: 'POST',
            data: hourData,
        });
    }

    // Modifier un créneau horaire
    static async updateHour(id, hourData) {
        console.log("Données envoyées à Axios :", hourData);
        return ApiService.request({
            url: `/hours/${id}`,
            method: 'PUT',
            data: hourData,
        });
    }

    // Supprimer un créneau horaire
    static async deleteHour(id) {
        return ApiService.request(`/hours/${id}`, {
            method: 'DELETE',
        });
    }
}

export default ScheduleHoursService;
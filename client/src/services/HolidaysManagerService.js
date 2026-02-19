// client/src/services/HolidaysManagerService.js
import api from '../api/axiosConfig';

const HolidaysManagerService = {
    uploadHolidaysFile: async (formData) => {
        try {
            const response = await api.post('/holidays/upload', formData, {
                headers: {
                    // Très important : ne pas définir manuellement le Content-Type ici
                    // Axios et le navigateur le feront automatiquement avec le bon "boundary"
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    getHolidays: async () => {
        try {
            const response = await api.get('/holidays');
            return response.data;
        } catch (error) {
            throw error;
        }
    }
};

export default HolidaysManagerService;
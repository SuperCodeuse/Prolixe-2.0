// client/src/services/ScheduleService.js
import axios from '../api/axiosConfig';

const ScheduleService = {
    getScheduleSets: async () => {
        // Suppression du 's' final pour correspondre à la route backend app.use('/api/schedule', ...)
        const response = await axios.get('/api/schedule/sets');
        return response.data;
    },

    createScheduleSet: async (name) => {
        const response = await axios.post('/api/schedule/sets', { name });
        return response.data;
    },

    getScheduleById: async (setId) => {
        const response = await axios.get(`/api/schedule/${setId}`);
        return response.data;
    },

    saveSlots: async (setId, slots) => {
        const response = await axios.post('/api/schedule/slots/save', {
            schedule_set_id: setId,
            slots: slots
        });
        return response.data;
    }
};

export default ScheduleService;
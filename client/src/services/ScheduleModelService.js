// client/src/services/ScheduleModelService.js

import apiClient from '../api/axiosConfig';

const ScheduleModelService = {

    getSchedules: (journalId) => {
        return apiClient.get('/schedule/sets', {
            params: { journal_id: journalId }
        });
    },



    createSchedule: (name, startDate, endDate, journalId) => {
        return apiClient.post('/schedule/sets', {
            name,
            start_date: startDate,
            end_date: endDate,
            journal_id: journalId
        });
    },


    deleteSchedule: (scheduleSetId) => {
        return apiClient.delete(`/schedule/sets/${scheduleSetId}`);
    },



    duplicateSchedule: (scheduleSetId, newName) => {
        return apiClient.post(`/schedule/sets/${scheduleSetId}/duplicate`, { newName });
    }
};

export default ScheduleModelService;
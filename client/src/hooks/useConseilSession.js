import { useState, useEffect } from 'react';
import * as ConseilService from '../services/ConseilClasseService';

export const useConseilSessions = (journalId) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchSessions = async () => {
        if (!journalId) return;
        setLoading(true);
        try {
            const res = await ConseilService.getSessions(journalId);
            setSessions(res.data.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchSessions(); }, [journalId]);

    const addSession = async (libelle) => {
        await ConseilService.createSession(journalId, libelle);
        await fetchSessions();
    };

    const removeSession = async (id) => {
        await ConseilService.deleteSession(id);
        await fetchSessions();
    };

    return { sessions, loading, addSession, removeSession };
};
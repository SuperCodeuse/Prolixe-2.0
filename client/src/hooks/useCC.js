import { useState, useEffect, useCallback } from 'react';
import { getConseilDataBySession, saveStudentConseil } from '../services/ConseilClasseService';
import { debounce } from 'lodash';

export const useConseilDeClasse = (sessionId, classId) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [savingStatus, setSavingStatus] = useState({});

    useEffect(() => {
        if (!sessionId || !classId) {
            setStudents([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await getConseilDataBySession(sessionId, classId);
                setStudents(res.data.data);
            } finally { setLoading(false); }
        };
        fetchData();
    }, [sessionId, classId]);

    const handleStudentChange = (studentId, field, value) => {
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, [field]: value } : s));
        debouncedSave(studentId, { [field]: value });
    };

    const debouncedSave = useCallback(debounce(async (studentId, data) => {
        setSavingStatus(prev => ({ ...prev, [studentId]: 'saving' }));
        try {
            await saveStudentConseil(sessionId, studentId, data);
            setSavingStatus(prev => ({ ...prev, [studentId]: 'saved' }));
        } catch {
            setSavingStatus(prev => ({ ...prev, [studentId]: 'error' }));
        }
    }, 1000), [sessionId]);

    return { students, loading, savingStatus, handleStudentChange };
};
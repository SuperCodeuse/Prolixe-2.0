// client/src/hooks/useSubjects.js
import { useState, useCallback } from 'react';
import SubjectService from '../services/SubjectService';
import { useToast } from './useToast';

export const useSubjects = () => {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const { success, error: showError } = useToast();

    const loadSubjects = useCallback(async (journalId) => {
        if (!journalId) return;
        try {
            setLoading(true);
            const res = await SubjectService.getSubjectsByJournal(journalId);
            setSubjects(res.data.data || []);
        } catch (err) {
            showError("Erreur lors du chargement des matières");
        } finally {
            setLoading(false);
        }
    }, [showError]);

    const addSubject = async (data) => {
        try {
            const res = await SubjectService.createSubject(data);
            success("Matière ajoutée");
            return res.data;
        } catch (err) {
            showError("Erreur lors de l'ajout");
            throw err;
        }
    };

    const updateSubject = async (id, updatedData) => {
        try {
            const res = await SubjectService.updateSubject(id, updatedData);
            success("Matière mise à jour");
            return res.data;
        } catch (err) {
            showError("Erreur lors de la modification");
            throw err;
        }
    };

    const removeSubject = async (id) => {
        try {
            await SubjectService.deleteSubject(id);
            setSubjects(prev => prev.filter(s => s.id !== id));
            success("Matière supprimée");
        } catch (err) {
            showError("Erreur lors de la suppression");
        }
    };

    return { subjects, loading, loadSubjects, addSubject, removeSubject, updateSubject};
};
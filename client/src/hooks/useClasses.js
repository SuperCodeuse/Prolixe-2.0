import { useState, useEffect, useCallback } from 'react';
import ClassService from '../services/ClassService';

/**
 * Hook pour gérer les données des classes, désormais dépendant d'un journal.
 * @param {number|string} journalId - L'ID du journal de classe sélectionné.
 */
export const useClasses = (journalId) => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Charge les classes associées à l'ID du journal fourni.
    const loadClasses = useCallback(async () => {
        if (!journalId) {
            setClasses([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            // Assurez-vous que ClassService.getClasses peut filtrer par journalId
            let response = await ClassService.getClasses(journalId);
            response = response.data;
            setClasses(response.data);
        } catch (err) {
            setError(err.message);
            console.error('Erreur chargement classes:', err);
        } finally {
            setLoading(false);
        }
    }, [journalId]); // La dépendance est maintenant `journalId`

    useEffect(() => {
        loadClasses();
    }, [loadClasses]);

    // Ajoute une classe en injectant automatiquement l'ID du journal.
    const addClass = async (classData) => {
        if (!journalId) {
            throw new Error("Impossible d'ajouter une classe sans journal sélectionné.");
        }
        try {
            const dataToSend = { ...classData, journal_id: journalId };
            let response = await ClassService.createClass(dataToSend);
            response = response.data;
            setClasses(prev => [...prev, response.data]);
            return response.data;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Mettre à jour une classe (la logique reste la même)
    const updateClass = async (id, classData) => {
        try {
            let response = await ClassService.updateClass(id, classData);
            response = response.data;
            setClasses(prev => prev.map(cls => (cls.id === id ? response.data : cls)));
            return response.data;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Supprimer une classe (la logique reste la même)
    const removeClass = async (id) => {
        try {
            await ClassService.deleteClass(id);
            setClasses(prev => prev.filter(cls => cls.id !== id));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Les fonctions utilitaires restent identiques
    const getClassColor = (subject, level) => {
        const extendedColors = {
            'TIC_3': '#93C5FD', 'TIC_4': '#1D4ED8', 'TIC_5': '#1E3A8A', 'TIC_6': '#0F172A',
            'Labo Ch._3': '#93C5FD', 'Labo Ch._4': '#1D4ED8', 'Labo Ch._5': '#1E3A8A', 'Labo Ch._6': '#0F172A',
            'Exp.logiciels_3': '#FDBA74', 'Exp.logiciels_4': '#D97706', 'Exp.logiciels_5': '#B45309', 'Exp.logiciels_6': '#78350F',
            'Chimie_3': '#FDBA74', 'Chimie_4': '#D97706', 'Chimie_5': '#B45309', 'Chimie_6': '#78350F',
            'Info_3': '#C4B5FD', 'Info_4': '#7C3AED', 'Info_5': '#5B21B6', 'Info_6': '#3C1363',
            'Sciences 3H_3': '#C4B5FD', 'Sciences 3H_4': '#7C3AED', 'Sciences 3H_5': '#5B21B6', 'Sciences 3H_6': '#3C1363',
            'Sciences_3': '#F3B0E9', 'Sciences_4': '#b9109d', 'Sciences_5': '#6B0B5A', 'Sciences_6': '#3C0530',
            'Txt_3': '#F3B0E9', 'Txt_4': '#b9109d', 'Txt_5': '#6B0B5A', 'Txt_6': '#3C0530',
            'Labo Phys._3': '#86EFAC', 'Labo Phys._4': '#059669', 'Labo Phys._5': '#047857', 'Labo Phys._6': '#064E3B',
            'Physique_3': '#047857', 'Physique_4': '#03695C', 'Physique_5': '#05504E', 'Physique_6': '#06363F',

            'default': '#475569'
        };
        const combinationKey = `${subject}_${level}`;
        if (extendedColors[combinationKey]) return extendedColors[combinationKey];
        const baseSubjectColorsFallback = {
            'TIC': '#3B82F6',
            'Txt' : '#b9109d',
            'Exp.logiciels': '#F59E0B',
            'Info': '#8B5CF6',
            'Labo Phys.': '#10B981'
        };
        return baseSubjectColorsFallback[subject] || extendedColors.default;
    };

    const getClassShortName = (name) => {
        const words = name.split(' ');
        if (words.length === 1) return name.substring(0, 6);
        return words.map(word => /\d/.test(word) ? word : word.charAt(0).toUpperCase()).join('').substring(0, 8);
    };

    const getClassesForSchedule = () => classes.map(cls => ({ ...cls, color: getClassColor(cls.subject, cls.level), shortName: getClassShortName(cls.name) }));
    const getUniqueSubjects = () => [...new Set(classes.map(cls => cls.subject))];

    return {
        classes,
        loading,
        error,
        loadClasses,
        addClass,
        updateClass,
        removeClass,
        getClassesForSchedule,
        getUniqueSubjects,
        getClassColor,
        getClassShortName
    };
};
import React, { useState, useEffect, useCallback } from 'react';
import ScheduleService from '../../../services/ScheduleService';
import { useToast } from '../../../hooks/useToast';
import { useScheduleHours } from "../../../hooks/useScheduleHours";
import { Plus, Save, Calendar, MapPin, BookOpen, Users, Loader2 } from 'lucide-react';
import './ScheduleCreator.scss';
import { useJournal } from '../../../hooks/useJournal';

const DAYS = [
    { id: 1, label: 'Lundi' }, { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' }, { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' }
];

const ScheduleCreator = () => {
    // Hooks & Services
    const { currentJournal } = useJournal(); // Assure-toi que l'import est présent
    const journalId = currentJournal?.id;
    const { success, error: showError } = useToast();
    const { hours, loading: loadingHours } = useScheduleHours();

    // États
    const [sets, setSets] = useState([]);
    const [newSetName, setNewSetName] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [grid, setGrid] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingSets, setLoadingSets] = useState(true);

    // Chargement initial des modèles
    const loadSets = useCallback(async () => {
        try {
            setLoadingSets(true);
            const res = await ScheduleService.getScheduleSets();
            setSets(res.data || []);
        } catch (err) {
            showError('Erreur de chargement des modèles');
        } finally {
            setLoadingSets(false);
        }
    }, [showError]);

    useEffect(() => {
        if (journalId) loadSets();
    }, [journalId, loadSets]);

    // Actions
    const handleCreateSet = async (e) => {
        e.preventDefault();
        if (!newSetName.trim()) return;

        try {
            setIsSubmitting(true);
            const res = await ScheduleService.createScheduleSet(newSetName, journalId);
            const newSet = { id: res.id || res.data?.id, name: newSetName, journal_id: journalId };
            setSets(prev => [...prev, newSet]);
            setNewSetName('');
            success('Nouvel emploi du temps créé');
        } catch (err) {
            showError('Erreur lors de la création');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSelectSet = async (setId) => {
        setSelectedSet(setId);
        if (!setId) {
            setGrid({});
            return;
        }

        try {
            const res = await ScheduleService.getScheduleById(setId);
            const formattedGrid = {};
            (res.data || []).forEach(slot => {
                formattedGrid[`${slot.day_of_week}-${slot.time_slot_id}`] = {
                    subject: slot.subject || '',
                    className: slot.class_name || slot.class || '',
                    room: slot.room || ''
                };
            });
            setGrid(formattedGrid);
        } catch (err) {
            showError('Erreur de récupération des données');
        }
    };

    const updateCell = (dayId, hourId, field, value) => {
        const key = `${dayId}-${hourId}`;
        setGrid(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { subject: '', className: '', room: '' }),
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        if (!selectedSet) return;

        setIsSubmitting(true);
        const slots = Object.entries(grid)
            .map(([key, data]) => {
                const [day, hourId] = key.split('-');
                return {
                    day_of_week: parseInt(day),
                    time_slot_id: parseInt(hourId),
                    subject: data.subject?.trim(),
                    class_name: data.className?.trim(),
                    room: data.room?.trim()
                };
            })
            .filter(slot => slot.subject || slot.class_name); // On ne garde que les slots remplis

        try {
            await ScheduleService.saveSlots(selectedSet, slots);
            success('Enregistré avec succès');
        } catch (err) {
            showError('Erreur de sauvegarde');
        } finally {
            setIsSubmitting(false);
        }
    };

    // États de chargement
    if (loadingHours || loadingSets) {
        return (
            <div className="glass-loader">
                <Loader2 className="animate-spin" />
                <p>Chargement des ressources...</p>
            </div>
        );
    }

    return (
        <div className="schedule-creator-glass">
            <header className="glass-header">
                <div className="section-title">
                    <Calendar size={22} />
                    <h2>Gestion des Emplois du Temps</h2>
                </div>

                <div className="actions-bar">
                    <form onSubmit={handleCreateSet} className="glass-form">
                        <input
                            type="text"
                            placeholder="Nom du modèle (ex: Semaine A)"
                            value={newSetName}
                            onChange={(e) => setNewSetName(e.target.value)}
                            className="glass-input"
                        />
                        <button type="submit" disabled={!newSetName.trim() || isSubmitting} className="glass-btn primary">
                            <Plus size={18} />
                        </button>
                    </form>

                    <div className="selector-group">
                        <select
                            value={selectedSet}
                            onChange={(e) => handleSelectSet(e.target.value)}
                            className="glass-select"
                        >
                            <option value="">Sélectionner un horaire</option>
                            {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>

                        {selectedSet && (
                            <button
                                className="glass-btn success"
                                onClick={handleSave}
                                disabled={isSubmitting}
                            >
                                <Save size={18} />
                                <span>{isSubmitting ? 'Enregistrement...' : 'Sauvegarder'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {selectedSet ? (
                <div className="table-container">
                    <table className="glass-table">
                        <thead>
                        <tr>
                            <th>Heures</th>
                            {DAYS.map(d => <th key={d.id}>{d.label}</th>)}
                        </tr>
                        </thead>
                        <tbody>
                        {hours.map(h => (
                            <tr key={h.id}>
                                <td className="time-label">
                                    <strong>{h.libelle}</strong>
                                    <small>{h.start_time} - {h.end_time}</small>
                                </td>
                                {DAYS.map(d => {
                                    const cell = grid[`${d.id}-${h.id}`] || {};
                                    return (
                                        <td className="grid-cell">
                                            <div className="input-group">
                                                {/* Sélecteur de Matière */}
                                                <div className="input-wrapper">
                                                    <BookOpen size={12} />
                                                    <select
                                                        value={cell.subject_id || ''}
                                                        onChange={(e) => updateCell(d.id, h.id, 'subject_id', e.target.value)}
                                                    >
                                                        <option value="">Matière...</option>
                                                        {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>

                                                {/* Sélecteur de Classe */}
                                                <div className="input-wrapper">
                                                    <Users size={12} />
                                                    <select
                                                        value={cell.class_id || ''}
                                                        onChange={(e) => updateCell(d.id, h.id, 'class_id', e.target.value)}
                                                    >
                                                        <option value="">Classe...</option>
                                                        {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>

                                                {/* Local reste en texte libre car il change souvent */}
                                                <div className="input-wrapper">
                                                    <MapPin size={12} />
                                                    <input
                                                        type="text"
                                                        placeholder="Local"
                                                        value={cell.room || ''}
                                                        onChange={(e) => updateCell(d.id, h.id, 'room', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <Calendar size={64} strokeWidth={1} />
                    <p>Sélectionnez un modèle ou créez-en un nouveau pour éditer l'emploi du temps.</p>
                </div>
            )}
        </div>
    );
};

export default ScheduleCreator;
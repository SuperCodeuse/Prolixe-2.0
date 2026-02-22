import React, { useState, useEffect, useCallback } from 'react';
import ScheduleService from '../../../services/ScheduleService';
import { useToast } from '../../../hooks/useToast';
import { useScheduleHours } from "../../../hooks/useScheduleHours";
import { useJournal } from '../../../hooks/useJournal';
import { useSubjects } from '../../../hooks/useSubjects';
import { useClasses } from '../../../hooks/useClasses';
import { Plus, Save, Calendar, MapPin, BookOpen, Users, Loader2 } from 'lucide-react';
import './ScheduleCreator.scss';

const DAYS = [
    { id: 1, label: 'Lundi' }, { id: 2, label: 'Mardi' },
    { id: 3, label: 'Mercredi' }, { id: 4, label: 'Jeudi' },
    { id: 5, label: 'Vendredi' }
];

const ScheduleCreator = () => {
    const { currentJournal } = useJournal();
    const journalId = currentJournal?.id;
    const { success, error: showError } = useToast();

    const { hours, loading: loadingHours } = useScheduleHours();
    const { subjects, loadSubjects, loading: loadingSubs } = useSubjects();
    const { getClassesForSchedule, loading: loadingCls } = useClasses(journalId);

    const [sets, setSets] = useState([]);
    const [newSetName, setNewSetName] = useState('');
    const [selectedSet, setSelectedSet] = useState('');
    const [grid, setGrid] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingSets, setLoadingSets] = useState(true);

    const loadInitialData = useCallback(async () => {
        if (!journalId) return;
        try {
            setLoadingSets(true);
            const [resSets] = await Promise.all([
                ScheduleService.getScheduleSets(),
                loadSubjects(journalId)
            ]);
            setSets(resSets.data || []);
        } catch (err) {
            showError('Erreur de chargement');
        } finally {
            setLoadingSets(false);
        }
    }, [journalId, loadSubjects, showError]);

    useEffect(() => { loadInitialData(); }, [loadInitialData]);

    // --- LOGIQUE DE COULEUR ---
    const getGradatedColor = (subjectId, classId) => {
        const subject = subjects.find(s => s.id == subjectId);
        console.log(subject);
        if (!subject || !subject.color_code) return 'white';

        const cls = getClassesForSchedule().find(c => c.id == classId);
        const level = cls ? parseInt(cls.level) || 1 : 1;

        // On ajuste la luminosité selon le niveau (1 = très clair, 6 = très foncé)
        // 85% (clair) -> 30% (foncé)
        const lightness = 85 - (level * 8);

        // On utilise la couleur hex d'origine mais on force la luminosité CSS
        // Note: On pourrait convertir en HSL, mais l'astuce color-mix ou hsl relative est plus simple
        return `color-mix(in srgb, ${subject.color_code}, black ${level * 10}%)`;
    };

    const handleCreateSet = async (e) => {
        e.preventDefault();
        if (!newSetName.trim() || !journalId) return;
        try {
            setIsSubmitting(true);
            const res = await ScheduleService.createScheduleSet(newSetName, journalId);
            const newId = res.id || res.data?.id;
            setSets(prev => [...prev, { id: newId, name: newSetName }]);
            setSelectedSet(newId);
            setNewSetName('');
            success('Modèle créé');
        } catch (err) { showError('Erreur création'); }
        finally { setIsSubmitting(false); }
    };

    const handleSelectSet = async (setId) => {
        setSelectedSet(setId);
        if (!setId) { setGrid({}); return; }
        try {
            const res = await ScheduleService.getScheduleById(setId);
            const formattedGrid = {};
            (res.data || []).forEach(slot => {
                formattedGrid[`${slot.day_of_week}-${slot.time_slot_id}`] = {
                    subject_id: slot.subject_id || '',
                    class_id: slot.class_id || '',
                    room: slot.room || ''
                };
            });
            setGrid(formattedGrid);
        } catch (err) { showError('Erreur récupération'); }
    };

    const updateCell = (dayId, hourId, field, value) => {
        const key = `${dayId}-${hourId}`;
        setGrid(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { subject_id: '', class_id: '', room: '' }),
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        if (!selectedSet) return;
        try {
            setIsSubmitting(true);
            const slots = Object.entries(grid)
                .map(([key, data]) => {
                    const [day, hourId] = key.split('-');
                    return {
                        day_of_week: parseInt(day),
                        time_slot_id: parseInt(hourId),
                        subject_id: data.subject_id ? parseInt(data.subject_id) : null,
                        class_id: data.class_id ? parseInt(data.class_id) : null,
                        room: data.room?.trim() || ''
                    };
                })
                .filter(slot => slot.subject_id || slot.class_id || slot.room);
            await ScheduleService.saveSlots(selectedSet, slots);
            success('Enregistré');
        } catch (err) { showError('Erreur sauvegarde'); }
        finally { setIsSubmitting(false); }
    };

    if (loadingHours || loadingSets || loadingSubs || loadingCls) {
        return <div className="glass-loader"><Loader2 className="animate-spin" /></div>;
    }

    const availableClasses = getClassesForSchedule();

    return (
        <div className="schedule-creator-glass">
            <header className="glass-header">
                <div className="section-title">
                    <Calendar size={22} className="accent-icon" />
                    <h2>Gestion de l'Emploi du Temps</h2>
                </div>
                <div className="actions-bar">
                    <form onSubmit={handleCreateSet} className="glass-form">
                        <input
                            type="text"
                            placeholder="Nouveau modèle..."
                            value={newSetName}
                            onChange={(e) => setNewSetName(e.target.value)}
                            className="glass-input"
                        />
                        <button type="submit" disabled={!newSetName.trim()} className="glass-btn primary"><Plus size={18}/></button>
                    </form>
                    <select value={selectedSet} onChange={(e) => handleSelectSet(e.target.value)} className="glass-select">
                        <option value="">Sélectionner un horaire</option>
                        {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {selectedSet && (
                        <button className="glass-btn success" onClick={handleSave} disabled={isSubmitting}>
                            <Save size={18} /> <span>{isSubmitting ? '...' : 'Sauvegarder'}</span>
                        </button>
                    )}
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
                                    <small>{h.start_time?.substring(0,5)}</small>
                                </td>
                                {DAYS.map(d => {
                                    const cell = grid[`${d.id}-${h.id}`] || {};
                                    const cellColor = getGradatedColor(cell.subject_id, cell.class_id);

                                    return (
                                        <td key={`${d.id}-${h.id}`} className="grid-cell" style={{ '--subject-color': cellColor }}>
                                            <div className="input-group">
                                                <div className="input-wrapper main-select">
                                                    <BookOpen size={12} className="icon" />
                                                    <select
                                                        value={cell.subject_id || ''}
                                                        onChange={(e) => updateCell(d.id, h.id, 'subject_id', e.target.value)}
                                                    >
                                                        <option value="">Matière</option>
                                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="input-wrapper">
                                                    <Users size={12} className="icon" />
                                                    <select
                                                        value={cell.class_id || ''}
                                                        onChange={(e) => updateCell(d.id, h.id, 'class_id', e.target.value)}
                                                    >
                                                        <option value="">Classe</option>
                                                        {availableClasses.map(c => <option key={c.id} value={c.id}>{c.shortName}</option>)}
                                                    </select>
                                                </div>
                                                <div className="input-wrapper">
                                                    <MapPin size={12} className="icon" />
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
                <div className="empty-state"><Calendar size={48} /><p>Sélectionnez un modèle pour commencer.</p></div>
            )}
        </div>
    );
};

export default ScheduleCreator;
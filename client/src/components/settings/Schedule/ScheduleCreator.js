import React, { useState, useEffect, useCallback } from 'react';
import ScheduleService from '../../../services/ScheduleService';
import { useToast } from '../../../hooks/useToast';
import { useScheduleHours } from "../../../hooks/useScheduleHours";
import { useJournal } from '../../../hooks/useJournal';
import { useSubjects } from '../../../hooks/useSubjects';
import { useClasses } from '../../../hooks/useClasses';
import ConfirmModal from '../../ConfirmModal';
import {
    Plus, Save, Calendar, MapPin, BookOpen,
    Users, Loader2, Copy, Trash2, Clock, X
} from 'lucide-react';
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

    // États de données
    const [sets, setSets] = useState([]);
    const [selectedSet, setSelectedSet] = useState('');
    const [grid, setGrid] = useState({});

    // États pour Création / Duplication
    const [newSetName, setNewSetName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingSets, setLoadingSets] = useState(true);

    const { hours, loading: loadingHours } = useScheduleHours();
    const { subjects, loadSubjects, loading: loadingSubs } = useSubjects();
    const { getClassesForSchedule, loading: loadingCls } = useClasses(journalId);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', onConfirm: null
    });

    const handleSelectSet = useCallback(async (setId) => {
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
        } catch (err) {
            showError('Erreur lors de la récupération des données');
        }
    }, [showError]);

    const loadInitialData = useCallback(async () => {
        if (!journalId) return;
        try {
            setLoadingSets(true);
            const [resSets] = await Promise.all([
                ScheduleService.getScheduleSets(journalId),
                loadSubjects(journalId)
            ]);
            const fetchedSets = resSets.data || [];
            setSets(fetchedSets);
            if (fetchedSets.length > 0) {
                handleSelectSet(fetchedSets[fetchedSets.length - 1].id);
            }
        } catch (err) {
            showError('Erreur de chargement');
        } finally {
            setLoadingSets(false);
        }
    }, [journalId, loadSubjects, showError, handleSelectSet]);

    useEffect(() => { loadInitialData(); }, [loadInitialData]);

    // --- CRÉATION ---
    const openCreateModal = (e) => {
        e.preventDefault();
        if (!newSetName.trim()) return;
        setStartDate('');
        setEndDate('');
        setIsCreateModalOpen(true);
    };

    const handleCreateSet = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const res = await ScheduleService.createScheduleSet(newSetName, journalId, startDate, endDate);
            const newId = res.id || res.data?.id;

            setSets(prev => [...prev, { id: newId, name: newSetName, start_time: startDate, end_time: endDate }]);
            handleSelectSet(newId);

            setNewSetName(''); setIsCreateModalOpen(false);
            success('Modèle créé avec succès');
        } catch (err) { showError('Erreur lors de la création'); }
        finally { setIsSubmitting(false); }
    };

    // --- DUPLICATION ---
    const openDuplicateModal = () => {
        const current = sets.find(s => s.id == selectedSet);
        setNewSetName(`${current?.name} - Copie`);
        setStartDate(''); // On force la saisie de nouvelles dates
        setEndDate('');
        setIsDuplicateModalOpen(true);
    };

    const handleDuplicateSet = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            // On envoie les nouvelles dates et le nouveau nom au service de duplication
            const res = await ScheduleService.duplicateScheduleSet(selectedSet, newSetName, startDate, endDate);

            setSets(prev => [...prev, { ...res, name: newSetName, start_time: startDate, end_time: endDate }]);
            setIsDuplicateModalOpen(false);
            handleSelectSet(res.id);
            success('Horaire dupliqué avec succès !');
        } catch (err) { showError('Erreur lors de la duplication'); }
        finally { setIsSubmitting(false); }
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
        } catch (err) { showError('Erreur de sauvegarde'); }
        finally { setIsSubmitting(false); }
    };

    const handleDelete = () => {
        const currentSet = sets.find(s => s.id == selectedSet);
        setConfirmModal({
            isOpen: true,
            title: "Suppression",
            message: `Supprimer "${currentSet?.name}" ?`,
            onConfirm: async () => {
                await ScheduleService.deleteScheduleSet(selectedSet);
                const updated = sets.filter(s => s.id != selectedSet);
                setSets(updated);
                if (updated.length > 0) handleSelectSet(updated[updated.length - 1].id);
                else { setSelectedSet(''); setGrid({}); }
            }
        });
    };

    const getGradatedColor = (subjectId, classId) => {
        const subject = subjects.find(s => s.id == subjectId);
        if (!subject || !subject.color_code) return 'white';
        const cls = getClassesForSchedule().find(c => c.id == classId);
        const level = cls ? parseInt(cls.level) || 1 : 1;
        return `color-mix(in srgb, ${subject.color_code}, black ${level * 10}%)`;
    };

    const updateCell = (dayId, hourId, field, value) => {
        const key = `${dayId}-${hourId}`;
        setGrid(prev => ({
            ...prev,
            [key]: { ...(prev[key] || { subject_id: '', class_id: '', room: '' }), [field]: value }
        }));
    };

    if (loadingHours || loadingSets || loadingSubs || loadingCls) {
        return <div className="glass-loader"><Loader2 className="animate-spin" size={40} /></div>;
    }

    const currentSetData = sets.find(s => s.id == selectedSet);

    return (
        <div className="schedule-creator-glass">
            <header className="glass-header">
                <div className="header-main-row">
                    <div className="section-title">
                        <Calendar size={24} className="accent-icon" />
                        <h2>Emploi du temps</h2>
                    </div>

                    <div className="header-actions">
                        <form onSubmit={openCreateModal} className="quick-create">
                            <input
                                type="text"
                                placeholder="Nom du nouveau modèle..."
                                value={newSetName}
                                onChange={(e) => setNewSetName(e.target.value)}
                                className="glass-input"
                            />
                            <button type="submit" className="glass-btn primary circle" title="Ajouter">
                                <Plus size={20} />
                            </button>
                        </form>

                        <div className="v-divider" />

                        <select
                            value={selectedSet}
                            onChange={(e) => handleSelectSet(e.target.value)}
                            className="glass-select"
                        >
                            <option value="">Sélectionner un horaire...</option>
                            {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {selectedSet && (
                    <div className="header-info-row">
                        <div className="validity-badge">
                            <Clock size={14} />
                            <span>Du {new Date(currentSetData?.start_time).toLocaleDateString()} au {new Date(currentSetData?.end_time).toLocaleDateString()}</span>
                        </div>
                        <div className="button-group">
                            <button className="glass-btn success" onClick={handleSave} disabled={isSubmitting}>
                                <Save size={18} /> <span>Sauvegarder</span>
                            </button>
                            <button className="glass-btn secondary" onClick={openDuplicateModal}>
                                <Copy size={18} />
                            </button>
                            <button className="glass-btn danger-text" onClick={handleDelete}>
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                )}
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
                                            <div className="cell-content">
                                                <div className="input-wrapper main-sub">
                                                    <BookOpen size={12} className="icon" />
                                                    <select value={cell.subject_id || ''} onChange={(e) => updateCell(d.id, h.id, 'subject_id', e.target.value)}>
                                                        <option value="">Matière</option>
                                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="input-wrapper">
                                                    <Users size={12} className="icon" />
                                                    <select value={cell.class_id || ''} onChange={(e) => updateCell(d.id, h.id, 'class_id', e.target.value)}>
                                                        <option value="">Classe</option>
                                                        {getClassesForSchedule().map(c => <option key={c.id} value={c.id}>{c.shortName}</option>)}
                                                    </select>
                                                </div>
                                                <div className="input-wrapper">
                                                    <MapPin size={12} className="icon" />
                                                    <input type="text" placeholder="Salle" value={cell.room || ''} onChange={(e) => updateCell(d.id, h.id, 'room', e.target.value)} />
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
                    <div className="icon-circle"><Calendar size={40} /></div>
                    <h3>Aucun horaire sélectionné</h3>
                    <p>Utilisez la barre en haut pour créer un nouveau modèle ou en charger un existant.</p>
                </div>
            )}

            {/* MODALE UNIQUE POUR CRÉATION ET DUPLICATION (Dates + Nom) */}
            {(isCreateModalOpen || isDuplicateModalOpen) && (
                <div className="modal-overlay">
                    <div className="glass-modal">
                        <div className="modal-header">
                            <h3>{isCreateModalOpen ? "Nouveau modèle" : "Dupliquer le modèle"}</h3>
                            <button className="close-btn" onClick={() => {
                                setIsCreateModalOpen(false);
                                setIsDuplicateModalOpen(false);
                            }}><X size={20}/></button>
                        </div>
                        <form onSubmit={isCreateModalOpen ? handleCreateSet : handleDuplicateSet}>
                            <div className="form-group mb-4">
                                <label>Nom du modèle</label>
                                <input
                                    type="text"
                                    value={newSetName}
                                    onChange={(e) => setNewSetName(e.target.value)}
                                    required
                                    className="glass-input"
                                />
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Date de début</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="glass-input" />
                                </div>
                                <div className="form-group">
                                    <label>Date de fin</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="glass-input" />
                                </div>
                            </div>
                            <div className="modal-footer mt-6">
                                <button type="button" className="glass-btn" onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setIsDuplicateModalOpen(false);
                                }}>Annuler</button>
                                <button type="submit" className="glass-btn primary" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : (isCreateModalOpen ? "Créer" : "Dupliquer")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onClose={() => setConfirmModal(p => ({...p, isOpen: false}))}
                onConfirm={async () => {
                    await confirmModal.onConfirm();
                    setConfirmModal(p => ({...p, isOpen: false}));
                }}
            />
        </div>
    );
};

export default ScheduleCreator;
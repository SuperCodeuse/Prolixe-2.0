import React, { useState } from 'react';
import { useClasses } from '../../../hooks/useClasses';
import { useToast } from '../../../hooks/useToast';
import ConfirmModal from '../../ConfirmModal';
import { useJournal } from '../../../hooks/useJournal';
import { GraduationCap, Users } from 'lucide-react';

import './ClassManager.scss';

const ClassesManager = () => {
    const { currentJournal } = useJournal();
    const journalId = currentJournal?.id;

    const { classes, loading, error, addClass, updateClass, removeClass } = useClasses(journalId);
    const { success, error: showError } = useToast();

    const [showAddForm, setShowAddForm] = useState(false);
    const [editingClass, setEditingClass] = useState(null);

    // Correction : Suppression de 'students' du formData car il est calculé par la BD (table STUDENTS)
    const [formData, setFormData] = useState({ name: '', level: '' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null });

    // Adapté selon vos besoins (chaînes de caractères pour plus de flexibilité)
    const levelOptions = ["1ère", "2ème", "3ème", "4ème", "5ème", "Rhétos"];

    const resetForm = () => {
        setFormData({ name: '', level: '' });
        setEditingClass(null);
        setShowAddForm(false);
    };

    const closeConfirmModal = () => setConfirmModal({ isOpen: false, onConfirm: null });
    const handleInputChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleEdit = (classItem) => {
        setEditingClass(classItem);
        setFormData({
            name: classItem.name || '',
            level: classItem.level || '',
        });
        setShowAddForm(true);
    };

    const handleDelete = (classItem) => {
        setConfirmModal({
            isOpen: true,
            title: 'Supprimer la classe',
            message: `Êtes-vous sûr de vouloir supprimer la classe "${classItem.name}" ? Tous les élèves associés, les évaluations et les emplois du temps de cette classe seront définitivement supprimés.`,
            onConfirm: () => performDelete(classItem.id, classItem.name),
        });
    };

    const performDelete = async (id, className) => {
        try {
            await removeClass(id);
            success(`Classe "${className}" supprimée.`);
            closeConfirmModal();
        } catch (err) {
            showError(err.message);
            closeConfirmModal();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.level) {
            showError("Le nom et le niveau sont requis.");
            return;
        }

        const classData = {
            ...formData,
            journal_id: journalId // Indispensable pour la création selon le nouveau contrôleur
        };

        try {
            if (editingClass) {
                await updateClass(editingClass.id, classData);
                success(`Classe "${classData.name}" modifiée.`);
            } else {
                await addClass(classData);
                success(`Classe "${classData.name}" ajoutée.`);
            }
            resetForm();
        } catch (err) {
            showError(err.response?.data?.message || "Une erreur est survenue.");
        }
    };

    const isUiDisabled = !currentJournal || currentJournal.is_archived;

    const renderContent = () => {
        if (loading) return <div className="state-message">⏳ Chargement des classes...</div>;
        if (error) return <div className="state-message error">❌ Erreur: {error}</div>;

        if (!Array.isArray(classes) || classes.length === 0) {
            return (
                <div className="no-data">
                    <p>Aucune classe dans ce journal.</p>
                    <button className="add-glass-btn btn-center" onClick={() => setShowAddForm(true)} disabled={isUiDisabled}>
                        Créer ma première classe
                    </button>
                </div>
            );
        }

        return (
            <div className="schedule-grid"> {/* Réutilisation des classes CSS du ScheduleManager pour la cohérence */}
                {classes.map((classItem, index) => (
                    <div key={classItem.id} className="schedule-card">
                        <div className="card-index">#{index + 1}</div>
                        <div className="card-info">
                            <span className="time">{classItem.name}</span>
                            <span className="duration">Niveau: {classItem.level}</span>
                            <div className="margin-top-2">
                                <span className="student-count"><Users size={14} /> {classItem.student_count || 0} élèves</span>
                            </div>
                        </div>

                        <div className="card-actions">
                            <button className="action-btn edit" onClick={() => handleEdit(classItem)}>✏️</button>
                            <button className="action-btn delete" onClick={() => handleDelete(classItem)}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="class-manager-container">
            <header className="manager-header">
                <div className="title-wrapper">
                    <div>
                        <h2><GraduationCap /> Gestion des Classes</h2>
                        <p>Journal : <strong>{currentJournal?.name || 'Aucun'}</strong></p>
                    </div>
                </div>
                {!isUiDisabled && (
                    <button className="add-glass-btn" onClick={() => { resetForm(); setShowAddForm(true); }}>
                        Nouvelle classe
                    </button>
                )}
            </header>

            {!!currentJournal?.is_archived && (
                <div className="archived-banner">⚠️ Ce journal est archivé. Les modifications sont désactivées.</div>
            )}

            {renderContent()}

            {showAddForm && (
                <div className="glass-modal-overlay">
                    <div className="glass-modal">
                        <h3>{editingClass ? 'Modifier la classe' : 'Ajouter une classe'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label>Nom de la classe (ex: 3ème A)</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="input-group">
                                <label>Niveau scolaire</label>
                                <select
                                    value={formData.level}
                                    onChange={(e) => handleInputChange('level', e.target.value)}
                                    required
                                >
                                    <option value="">Sélectionner un niveau</option>
                                    {levelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={resetForm}>Annuler</button>
                                <button type="submit" className="confirm-btn">
                                    {editingClass ? 'Modifier' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                {...confirmModal}
                onClose={closeConfirmModal}
                type="danger"
            />
        </div>
    );
};

export default ClassesManager;
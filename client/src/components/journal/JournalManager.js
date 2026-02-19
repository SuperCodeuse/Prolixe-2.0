// client/src/components/settings/Journal/JournalManager.js
import React, { useState, useMemo } from 'react';
import { useJournal } from '../../hooks/useJournal';
import { useSchoolYears } from '../../hooks/useSchoolYear';
import { useToast } from '../../hooks/useToast';
import ConfirmModal from '../ConfirmModal';
import JournalService from '../../services/JournalService';
import './JournalManager.scss';

const JournalManager = () => {
    const {
        journals,
        currentJournal,
        archivedJournals,
        selectJournal,
        createJournal,
        archiveJournal,
        deleteArchivedJournal,
        clearJournal,
        loading: journalLoading,
        loadAllJournals,
    } = useJournal();

    const { schoolYears, loading: schoolYearsLoading, error: schoolYearsError } = useSchoolYears();
    const { success, error: showError } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', school_year_id: '' });
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        successMessage: '' // Ajout d'un message personnalisé en cas de succès
    });

    const [selectedFile, setSelectedFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importTargetJournalId, setImportTargetJournalId] = useState('');

    const activeJournals = useMemo(() => journals.filter(j => !j.is_archived), [journals]);
    const otherActiveJournals = useMemo(() =>
            activeJournals.filter(j => j.id !== currentJournal?.id),
        [activeJournals, currentJournal]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file?.type === 'application/json') setSelectedFile(file);
        else {
            showError('Veuillez sélectionner un fichier JSON valide.');
            e.target.value = null;
        }
    };

    const handleImport = async () => {
        if (!selectedFile || !importTargetJournalId) return;
        setIsImporting(true);
        try {
            const response = await JournalService.importJournal(selectedFile, importTargetJournalId);
            success(response.message || 'Importation réussie !');
            loadAllJournals();
        } catch (err) {
            showError(err.message || 'Erreur lors de l\'importation.');
        } finally {
            setIsImporting(false);
            setSelectedFile(null);
            setImportTargetJournalId('');
        }
    };

    // Helper pour configurer la modal avec un message de succès
    const showConfirm = (title, message, onConfirm, successMessage) => {
        setConfirmModal({ isOpen: true, title, message, onConfirm, successMessage });
    };

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createJournal(formData);
            success('Nouveau journal créé avec succès !');
            setIsModalOpen(false);
            setFormData({ name: '', school_year_id: '' });
        } catch (err) {
            showError(err.response?.data?.message || "Erreur lors de la création.");
        }
    };

    const JournalCard = ({ journal, type }) => {
        const isSelected = journal.id === currentJournal?.id;
        const isArchived = type === 'archived';
        const hasEntries = journal.entries_count > 0;

        return (
            <div className={`journal-card ${isArchived ? 'archived' : ''} ${isSelected ? 'current' : ''}`}>
                <div className="journal-info">
                    <strong>{journal.name}</strong>
                    <span>{journal.year_label}</span>
                    {hasEntries && <small>{journal.entries_count} entrée(s)</small>}
                </div>
                <div className="journal-actions">
                    {isSelected && !isArchived && <span className="status-badge current">Actif</span>}
                    {isSelected && isArchived && <span className="status-badge selected">Visualisé</span>}

                    {!isSelected && (
                        <button onClick={() => selectJournal(journal)} className="btn-select">
                            {isArchived ? 'Visualiser' : 'Sélectionner'}
                        </button>
                    )}

                    {!isArchived && (
                        <>
                            <button
                                onClick={() => showConfirm(
                                    'Vider le journal',
                                    `Vider ${journal.name} ? Cette action est irréversible.`,
                                    () => clearJournal(journal.id),
                                    'Journal vidé avec succès.'
                                )}
                                className="btn-clear"
                                disabled={!hasEntries}
                            >
                                Vider
                            </button>
                            <button
                                onClick={() => showConfirm(
                                    'Archiver le journal',
                                    `Archiver ${journal.name} ? Il passera en lecture seule.`,
                                    () => archiveJournal(journal.id),
                                    'Journal archivé.'
                                )}
                                className="btn-archive"
                                disabled={activeJournals.length <= 1}
                            >
                                Archiver
                            </button>
                        </>
                    )}

                    {isArchived && (
                        <button
                            onClick={() => showConfirm(
                                'Supprimer le journal',
                                `Supprimer définitivement ${journal.name} ?`,
                                () => deleteArchivedJournal(journal.id),
                                'Journal supprimé.'
                            )}
                            className="btn-delete"
                        >
                            Supprimer
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="journal-manager">
            {/* ... section-header et journal-lists identiques ... */}
            <div className="section-header">
                <h2>📚 Gestion des Journaux</h2>
                <div className="file-container">
                    <div className="import-section">
                        <select
                            value={importTargetJournalId}
                            onChange={(e) => setImportTargetJournalId(e.target.value)}
                            className="btn-select"
                        >
                            <option value="">Importer dans...</option>
                            {activeJournals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                        </select>
                        <input type="file" id="import-input" accept=".json" onChange={handleFileChange} hidden />
                        <label htmlFor="import-input" className="file-input-label">📁 {selectedFile ? selectedFile.name : 'Choisir un fichier'}</label>
                        {selectedFile && (
                            <button className="btn-primary" onClick={handleImport} disabled={isImporting}>
                                {isImporting ? '...' : 'Lancer Import'}
                            </button>
                        )}
                    </div>
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}><span>➕</span> Ajouter un journal</button>
                </div>
            </div>

            <div className="journal-lists">
                <div className="journal-list">
                    <h3>Journal sélectionné</h3>
                    {currentJournal ? <JournalCard journal={currentJournal} type={currentJournal.is_archived ? 'archived' : 'active'} /> : <p>Aucune sélection.</p>}
                </div>

                <div className="journal-list">
                    <h3>Autres journaux actifs</h3>
                    {otherActiveJournals.length > 0 ?
                        otherActiveJournals.map(j => <JournalCard key={j.id} journal={j} type="active" />)
                        : <p>Aucun autre journal actif.</p>
                    }
                </div>

                <div className="journal-list">
                    <h3>Journaux archivés</h3>
                    {archivedJournals.length > 0 ?
                        archivedJournals.map(j => <JournalCard key={j.id} journal={j} type="archived" />)
                        : <p>Aucun journal archivé.</p>
                    }
                </div>
            </div>

            {/* Modal de création identique */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Créer un nouveau journal</h3>
                            <button className="modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="class-form">
                            <div className="form-group">
                                <label htmlFor="journalName">Nom du journal</label>
                                <input
                                    id="journalName"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    type="text"
                                    required
                                    placeholder="Ex: Journal 2024-2025"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="schoolYear">Année scolaire</label>
                                <select
                                    id="schoolYear"
                                    name="school_year_id"
                                    value={formData.school_year_id}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">-- Sélectionnez une année --</option>
                                    {schoolYears.map(sy => (
                                        <option key={sy.id} value={sy.id}>
                                            {sy.label || `${sy.start_date} - ${sy.end_date}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                                <button type="submit" className="btn-primary" disabled={!formData.name || !formData.school_year_id}>Créer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onClose={closeConfirmModal}
                onConfirm={async () => {
                    try {
                        await confirmModal.onConfirm();
                        success(confirmModal.successMessage || 'Action effectuée avec succès.');
                    } catch (err) {
                        showError(err.message || 'Une erreur est survenue.');
                    } finally {
                        closeConfirmModal();
                    }
                }}
            />
        </div>
    );
};

export default JournalManager;
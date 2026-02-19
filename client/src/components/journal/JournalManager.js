// client/src/components/settings/Journal/JournalManager.js
import React, { useState, useEffect } from 'react';
import { useJournal } from '../../hooks/useJournal';
import { useSchoolYears } from '../../hooks/useSchoolYear';
import { useToast } from '../../hooks/useToast';
import ConfirmModal from '../ConfirmModal';
import JournalService from '../../services/JournalService';
import SchoolYearDisplay from '../../hooks/SchoolYearDisplay';
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
        error: journalError,
        loadAllJournals,
    } = useJournal();

    const { schoolYears, loading: schoolYearsLoading, error: schoolYearsError } = useSchoolYears();
    const { success, error: showError } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', school_year_id: '' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [selectedFile, setSelectedFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importTargetJournalId, setImportTargetJournalId] = useState('');

    useEffect(() => {
        if (journalError) {
            showError(journalError.message || journalError);
        }
    }, [journalError, showError]);

    const handleClear = (journal) => {
        showConfirmModal(
            'Vider le journal',
            `Êtes-vous sûr de vouloir vider le journal "${journal.name}" ? Toutes ses entrées seront définitivement supprimées. Cette action est irréversible.`,
            async () => {
                try {
                    await clearJournal(journal.id);
                    success(`Journal "${journal.name}" vidé avec succès.`);
                    closeConfirmModal();
                } catch (err) {
                    showError(err.message || "Erreur lors du vidage du journal.");
                    closeConfirmModal();
                }
            }
        );
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/json') {
            setSelectedFile(file);
        } else {
            showError('Veuillez sélectionner un fichier JSON valide.');
            setSelectedFile(null);
            event.target.value = null;
        }
    };

    const handleImport = async () => {
        if (!selectedFile || !importTargetJournalId) {
            showError('Veuillez sélectionner un fichier et un journal de destination.');
            return;
        }
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
            const fileInput = document.getElementById('import-journal-input');
            if(fileInput) fileInput.value = null;
        }
    };

    const handleOpenModal = () => {
        setFormData({ name: '', school_year_id: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showError("Le nom du journal ne peut pas être vide.");
            return;
        }
        if (!formData.school_year_id) {
            showError("Veuillez sélectionner une année scolaire.");
            return;
        }
        try {
            await createJournal(formData);
            success('Nouveau journal créé avec succès !');
            handleCloseModal();
        } catch (err) {
            showError(err.message || "Erreur lors de la création du journal.");
        }
    };

    const handleArchive = (journal) => {
        showConfirmModal(
            'Archiver le journal',
            `Êtes-vous sûr de vouloir archiver le journal "${journal.name}" ? Vous ne pourrez plus y ajouter d'entrées.`,
            async () => {
                try {
                    await archiveJournal(journal.id);
                    success('Journal archivé.');
                    closeConfirmModal();
                } catch (err) {
                    showError(err.message);
                    closeConfirmModal();
                }
            }
        );
    };

    const handleDelete = (journal) => {
        showConfirmModal(
            'Supprimer le journal',
            `Êtes-vous sûr de vouloir supprimer définitivement le journal archivé "${journal.name}" ? Cette action est irréversible.`,
            async () => {
                try {
                    await deleteArchivedJournal(journal.id);
                    success('Journal supprimé définitivement.');
                    closeConfirmModal();
                } catch (err) {
                    showError(err.message);
                    closeConfirmModal();
                }
            }
        );
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const showConfirmModal = (title, message, onConfirm) => {
        setConfirmModal({ isOpen: true, title, message, onConfirm });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
    };

    const activeJournals = journals.filter(j => !j.is_archived);

    if (journalLoading && journals.length) return <p>Chargement des journaux...</p>;

    return (
        <div className="journal-manager">
            <div className="section-header">
                <h2>📚 Gestion des Journaux</h2>
                <div className="file-container">
                    <div className="import-section">
                        <select
                            value={importTargetJournalId}
                            onChange={(e) => setImportTargetJournalId(e.target.value)}
                            disabled={isImporting || activeJournals.length === 0}
                            className="btn-select"
                        >
                            <option value="">Importer dans...</option>
                            {activeJournals.map(j => (
                                <option key={j.id} value={j.id}>{j.name}</option>
                            ))}
                        </select>
                        <input
                            type="file"
                            id="import-journal-input"
                            accept=".json"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="import-journal-input" className="file-input-label">
                            📁 Choisir un fichier
                        </label>
                        {selectedFile && (
                            <button
                                className="btn-primary"
                                onClick={handleImport}
                                disabled={!selectedFile || isImporting || !importTargetJournalId}
                            >
                                {isImporting ? 'Importation...' : `Importer dans "${journals.find(j => j.id === importTargetJournalId)?.name}"`}
                            </button>
                        )}
                    </div>
                    <button className="btn-primary" onClick={handleOpenModal}>
                        <span>➕</span> Ajouter un journal
                    </button>
                </div>
            </div>

            <div className="journal-lists">
                <div className="journal-list">
                    <h3>Journal Courant / Visualisé</h3>
                    {currentJournal ? (
                        <div className={`journal-card ${currentJournal.is_archived ? 'archived' : ''} current`}>
                            <div className="journal-info">
                                <strong>{currentJournal.name}</strong>
                                <span><SchoolYearDisplay schoolYearId={currentJournal.school_year_id} /></span>
                            </div>
                            <div className="journal-actions">
                                {currentJournal.is_archived ? (
                                    <span className="status-badge archived">Lecture seule</span>
                                ) : (
                                    <>
                                        <span className="status-badge current">Actif</span>
                                        <button onClick={() => handleClear(currentJournal)} className="btn-clear">Vider</button>
                                        <button onClick={() => handleArchive(currentJournal)} className="btn-archive" disabled={activeJournals.length <= 1}>Archiver</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p>Aucun journal courant sélectionné. Choisissez-en un ci-dessous.</p>
                    )}
                </div>

                <div className="journal-list">
                    <h3>Autres Journaux Actifs</h3>
                    {activeJournals.filter(j => j.id !== currentJournal?.id).length > 0 ? (
                        activeJournals.filter(j => j.id !== currentJournal?.id).map(journal => (
                            <div key={journal.id} className="journal-card">
                                <div className="journal-info">
                                    <strong>{journal.name}</strong>
                                    <span><SchoolYearDisplay schoolYearId={journal.school_year_id} /></span>
                                </div>
                                <div className="journal-actions">
                                    <button onClick={() => selectJournal(journal)} className="btn-select">Sélectionner</button>
                                    <button onClick={() => handleClear(journal)} className="btn-clear">Vider</button>
                                    <button onClick={() => handleArchive(journal)} className="btn-archive" disabled={activeJournals.length <= 1}>Archiver</button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p>Aucun autre journal actif.</p>
                    )}
                </div>

                <div className="journal-list">
                    <h3>Journaux Archivés</h3>
                    {archivedJournals.length > 0 ? (
                        archivedJournals.map(journal => (
                            <div key={journal.id} className={`journal-card archived ${journal.id === currentJournal?.id ? 'current' : ''}`}>
                                <div className="journal-info">
                                    <strong>{journal.name}</strong>
                                    <span><SchoolYearDisplay schoolYearId={journal.school_year_id} /></span>
                                </div>
                                <div className="journal-actions">
                                    {journal.id === currentJournal?.id ? (
                                        <span className="status-badge selected">Visualisé</span>
                                    ) : (
                                        <button onClick={() => selectJournal(journal)} className="btn-select">Visualiser</button>
                                    )}
                                    <button onClick={() => handleDelete(journal)} className="btn-delete">Supprimer</button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p>Aucun journal archivé.</p>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Créer un nouveau journal</h3>
                            <button className="modal-close" onClick={handleCloseModal}>✕</button>
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
                                    placeholder="Ex: Journal de classe 2024-2025"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="schoolYear">Année scolaire</label>
                                {schoolYearsLoading ? <p>Chargement...</p> : schoolYearsError ? <p className="error-message">{schoolYearsError}</p> :
                                    <select
                                        id="schoolYear"
                                        name="school_year_id"
                                        value={formData.school_year_id}
                                        onChange={handleFormChange}
                                        required
                                    >
                                        <option value="">-- Sélectionnez une année --</option>
                                        {schoolYears.map(sy => (
                                            <option key={sy.id} value={sy.id}>{sy.start_date} - {sy.end_date}</option>
                                        ))}
                                    </select>}
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>Annuler</button>
                                <button type="submit" className="btn-primary" disabled={schoolYearsLoading || !formData.name || !formData.school_year_id}>Créer</button>
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
                onConfirm={confirmModal.onConfirm}
                confirmText="Confirmer"
                cancelText="Annuler"
                type="danger"
            />
        </div>
    );
};

export default JournalManager;
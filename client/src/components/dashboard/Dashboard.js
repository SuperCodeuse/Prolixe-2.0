import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useJournal } from '../../hooks/useJournal';
import { useNavigate } from 'react-router-dom';
import './dashboard.scss';
import './dashboard_mobile.scss';
import NoteSection from './NoteSection';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const {
        journals,
        currentJournal,
        selectJournal,
        loadAllJournals,
        loading: loadingJournal
    } = useJournal();

    useEffect(() => {
        loadAllJournals();
    }, [loadAllJournals]);

    const availableJournals = useMemo(() => journals, [journals]);

    const handleJournalChange = (e) => {
        const journalId = parseInt(e.target.value);
        const selected = journals.find(j => j.id === journalId);
        if (selected) {
            selectJournal(selected);
        }
    };

    if (!user) {
        return (
            <div className="dashboard-page">
                <div className="loading-message">Chargement de votre session...</div>
            </div>
        );
    }

    if (!loadingJournal && journals.length === 0) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-header">
                    <h1>Bonjour {user.firstname} !</h1>
                </div>
                <div className="no-journal-container">
                    <div className="error-card">
                        <div className="error-icon-wrapper">📁</div>
                        <h2>Aucun journal trouvé</h2>
                        <p>Vous devez créer un journal de classe pour commencer à utiliser Prolixe.</p>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/settings', { state: { activeTab: 'journals' } })}
                        >
                            ➕ Créer mon premier journal
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div className="header-greeting">
                    <h1>Bonjour {user.firstname} !</h1>
                    <p className="subtitle">Heureux de vous revoir sur votre espace de travail.</p>
                </div>

                <div className="journal-context-selector">
                    <div className="selector-label">
                        <span>Journal actif</span>
                    </div>
                    <div className="select-wrapper">
                        <select
                            id="journal-select"
                            value={currentJournal?.id || ''}
                            onChange={handleJournalChange}
                            className="custom-journal-select"
                            disabled={loadingJournal}
                        >
                            {!currentJournal && <option value="">Choisir un journal...</option>}
                            {availableJournals.map(j => (
                                <option key={j.id} value={j.id}>
                                    {j.name} {j.is_archived ? ' (Archivé)' : ''}
                                </option>
                            ))}
                        </select>
                        <span className="select-arrow">▾</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-content">
                {currentJournal ? (
                    <div className="dashboard-columns">

                        <div className="column main-column">
                            {!!currentJournal.is_archived && (
                                <div className="archive-banner">
                                    <div className="banner-text">
                                        <strong>Mode consultation</strong>
                                        <p>Ce journal est archivé. Les modifications sont désactivées.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="column side-column">

                        </div>
                    </div>
                ) : (
                    <div className="no-selection-placeholder">
                        <p>Veuillez sélectionner un journal dans le menu supérieur pour commencer.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
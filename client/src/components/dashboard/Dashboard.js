import React, { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useJournal } from '../../hooks/useJournal'; // Assurez-vous d'importer votre hook
import { useNavigate } from 'react-router-dom';
import './dashboard.scss';
import './dashboard_mobile.scss';
import NoteSection from './NoteSection';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const { currentJournal, loadAllJournals, loading: loadingJournal } = useJournal();

    useEffect(() => {
        loadAllJournals();
    }, [loadAllJournals]);

    if (!user || loadingJournal) {
        return (
            <div className="dashboard-page">
                <div className="loading-message">Chargement de votre session...</div>
            </div>
        );
    }

    if (!currentJournal) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-header">
                    <h1>Bonjour {user.firstname} !</h1>
                    <p>Bienvenue sur votre tableau de bord Prolixe</p>
                </div>

                <div className="no-journal-container">
                    <div className="error-card">
                        <div className="error-icon-wrapper">
                            ❌
                        </div>
                        <h2>Aucun journal sélectionné</h2>
                        <p>
                            Oups ! Il semblerait que vous n'ayez pas encore choisi de journal de classe
                            pour cette session. Vous en avez besoin pour consulter votre emploi du temps
                            et vos notes.
                        </p>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/settings/journals')}
                        >
                            📁 Sélectionner un journal
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h1>Bonjour {user.firstname} ! </h1>
                <p>Tableau de bord : <strong>{currentJournal.name}</strong></p>
            </div>

            <div className="dashboard-content">
                <div className="dashboard-columns">
                    <div className="column side-column">
                        <NoteSection />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
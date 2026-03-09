import React, { useState, useMemo } from 'react';
import { useJournal } from '../../hooks/useJournal';
import { useClasses } from '../../hooks/useClasses';
import { useConseilSessions } from '../../hooks/useConseilSession';
import { useConseilDeClasse } from '../../hooks/useCC';
import { Plus, Trash2, Settings, Users, Calendar } from 'lucide-react';
import './conseilClasse.scss';

// --- 1. SOUS-COMPOSANTS UTILITAIRES ---

const SavingIndicator = ({ status }) => {
    if (status === 'saving') return <span className="saving-indicator">💾 Sauvegarde...</span>;
    if (status === 'saved') return <span className="saving-indicator saved"> ✅ Enregistré !</span>;
    if (status === 'error') return <span className="saving-indicator error">❌ Erreur</span>;
    return null;
};

const StudentRow = React.memo(({ student, onStudentChange, savingStatus }) => (
    <tr className="student-table__row">
        <td data-label="Élève">{`${student.firstname} ${student.lastname}`}</td>
        <td data-label="Avis et notes">
            <textarea
                value={student.notes || ''}
                onChange={e => onStudentChange(student.id, 'notes', e.target.value)}
                placeholder="Synthèse, encouragements..."
                rows="3"
            />
        </td>
        <td data-label="Décision proposée">
            <select
                value={student.decision || 'AO-A'}
                onChange={e => onStudentChange(student.id, 'decision', e.target.value)}
            >
                <option value="AO-A">AO-A</option>
                <option value="AO-B">AO-B</option>
                <option value="AO-C">AO-C</option>
            </select>
        </td>
        <td data-label="Statut">
            <SavingIndicator status={savingStatus} />
        </td>
    </tr>
));

const StudentTable = ({ students, onStudentChange, savingStatus }) => (
    <table className="student-table">
        <thead>
        <tr>
            <th>Élève</th>
            <th>Avis et notes du conseil</th>
            <th>Décision proposée</th>
            <th>Statut</th>
        </tr>
        </thead>
        <tbody>
        {students.map(student => (
            <StudentRow
                key={student.id}
                student={student}
                onStudentChange={onStudentChange}
                savingStatus={savingStatus[student.id]}
            />
        ))}
        </tbody>
    </table>
);

// --- 2. COMPOSANT PRINCIPAL ---

const ConseilDeClasse = () => {
    const { currentJournal } = useJournal();
    const journalId = currentJournal?.id;

    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [isManageMode, setIsManageMode] = useState(false);
    const [newSessionName, setNewSessionName] = useState('');

    const { classes, loading: loadingClasses } = useClasses(journalId);
    const { sessions, addSession, removeSession, loading: loadingSessions } = useConseilSessions(journalId);
    const { students, loading: loadingStudents, savingStatus, handleStudentChange } = useConseilDeClasse(selectedSessionId, selectedClassId);

    const content = useMemo(() => {
        if (!selectedSessionId || !selectedClassId) {
            return <div className="placeholder-text">Sélectionnez une période et une classe pour afficher les élèves.</div>;
        }
        if (loadingStudents) return <p>Chargement des élèves...</p>;
        if (students?.length === 0) return <p className="placeholder-text">Aucun élève trouvé.</p>;

        return <StudentTable students={students} onStudentChange={handleStudentChange} savingStatus={savingStatus} />;
    }, [selectedSessionId, selectedClassId, loadingStudents, students, handleStudentChange, savingStatus]);

    return (
        <div className="conseil-de-classe">
            <header className="page-header">
                <div className="header-top">
                    <h2>Conseils de Classe</h2>
                    <button className="add-glass-btn" onClick={() => setIsManageMode(!isManageMode)}>
                        <Settings size={18} />
                        {isManageMode ? "Retour à la saisie" : "Gérer les périodes"}
                    </button>
                </div>

                {!isManageMode && (
                    <div className="selectors-container">
                        <div className="input-group">
                            <label><Calendar size={14}/> Période</label>
                            <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}>
                                <option value="">-- Choisir (ex: Noël) --</option>
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                            </select>
                        </div>

                        <div className="input-group">
                            <label><Users size={14}/> Classe</label>
                            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                                <option value="">-- Choisir une classe --</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </header>

            <main className="main-content">
                {isManageMode ? (
                    <div className="session-manager-view">
                        <h3>Configuration des conseils de l'année</h3>
                        <div className="add-session-form">
                            <input
                                placeholder="Nom de la session (ex: Bilan de Pâques)"
                                value={newSessionName}
                                onChange={e => setNewSessionName(e.target.value)}
                            />
                            <button className="confirm-btn" onClick={() => { addSession(newSessionName); setNewSessionName(''); }}>
                                + Créer la session
                            </button>
                        </div>
                        <div className="schedule-grid">
                            {sessions.map((s, idx) => (
                                <div key={s.id} className="schedule-card">
                                    <div className="card-index">#{idx + 1}</div>
                                    <div className="card-info">
                                        <span className="time">{s.libelle}</span>
                                    </div>
                                    <div className="card-actions">
                                        <button className="action-btn delete" onClick={() => removeSession(s.id)}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    content
                )}
            </main>
        </div>
    );
};

// --- 3. EXPORTATION ---
export default ConseilDeClasse;
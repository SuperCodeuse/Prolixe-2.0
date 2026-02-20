import React, { useState, useEffect, useCallback } from 'react';
import { useClasses } from '../../../hooks/useClasses';
import StudentService from '../../../services/StudentService';
import { useToast } from '../../../hooks/useToast';
import { useJournal } from '../../../hooks/useJournal';
import ConfirmModal from '../../ConfirmModal';
import { Users } from 'lucide-react';
import './StudentManager.scss';

const StudentManager = () => {
    const { currentJournal } = useJournal();
    const journalId = currentJournal?.id;

    const { classes, loading: classesLoading } = useClasses(journalId);

    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({ firstname: '', lastname: '' });
    const { success, error } = useToast();

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
    });

    const fetchStudents = useCallback(async () => {
        if (!selectedClass) {
            setStudents([]);
            return;
        }
        setIsLoading(true);
        try {
            const response = await StudentService.getStudentsByClass(selectedClass);

            setStudents(response.data.data);
        } catch (err) {
            error('Erreur de chargement des élèves.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedClass, error]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    useEffect(() => {
        setSelectedClass('');
    }, [classes]);

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (!formData.firstname.trim() || !formData.lastname.trim()) {
            error("Le prénom et le nom de l'élève sont requis.");
            return;
        }
        try {
            const studentData = {
                ...formData,
                class_id: selectedClass,
            };
            await StudentService.createStudent(studentData);
            success('Élève ajouté avec succès !');
            setFormData({ firstname: '', lastname: '' });
            await fetchStudents();
        } catch (err) {
            error(err.response?.data?.message || 'Erreur lors de l\'ajout de l\'élève.');
        }
    };

    const performDelete = async (studentId, studentName) => {
        try {
            await StudentService.deleteStudent(studentId);
            success(`${studentName} a été supprimé.`);
            await fetchStudents();
        } catch (err) {
            error(err.response?.data?.message || 'Erreur lors de la suppression.');
        } finally {
            closeConfirmModal();
        }
    };

    const handleDeleteStudent = (studentId, studentName) => {
        setConfirmModal({
            isOpen: true,
            title: 'Supprimer l\'élève',
            message: `Êtes-vous sûr de vouloir supprimer ${studentName} ? Cette action est définitive.`,
            onConfirm: () => performDelete(studentId, studentName),
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
    };


    const isUiDisabled = !currentJournal || currentJournal.is_archived;

    return (
        <div className="student-manager">
            <h2><Users className="icon-lucid"/> Gestion des élèves</h2>

            {currentJournal ? (
                <div className="current-year-info">
                    Gestion pour le journal : <strong>{currentJournal.name}</strong>
                    {currentJournal.is_archived ? (<span className="archived-tag"> (Archivé)</span>) : null}
                </div>
            ) : (
                <div className="error-message">Aucun journal de classe sélectionné.</div>
            )}

            <div className="form-group">
                <label>Sélectionnez une classe</label>
                <select
                    className="glass-select" // Changé ici
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    disabled={isUiDisabled || classesLoading || (Array.isArray(classes) && classes.length === 0)}
                >
                    <option value="">-- Choisissez une classe --</option>
                    {classesLoading && <option>Chargement des classes...</option>}
                    {Array.isArray(classes) && classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {selectedClass && !isUiDisabled && (
                <>
                    <form onSubmit={handleAddStudent} className="add-student-form">
                        <input
                            type="text"
                            className="glass-input" // Changé ici
                            value={formData.firstname}
                            onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                            placeholder="Prénom" required
                        />
                        <input
                            type="text"
                            className="glass-input" // Changé ici
                            value={formData.lastname}
                            onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                            placeholder="Nom" required
                        />
                        <button type="submit" className="btn-primary">Ajouter</button>
                    </form>

                    <div className="student-list">
                        {isLoading ? (
                            <p className="loading-text">Chargement des élèves...</p>
                        ) : (
                            <>
                                {students.map(student => (
                                    <div key={student.id} className="student-item">
                                        <span>{student.lastname.toUpperCase()} {student.firstname}</span>
                                        <button
                                            onClick={() => handleDeleteStudent(student.id, `${student.firstname} ${student.lastname}`)}
                                            className="btn-delete"
                                            title="Supprimer"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                                {students.length === 0 && <p className="empty-text">Aucun élève dans cette classe.</p>}
                            </>
                        )}
                    </div>
                </>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onClose={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
                confirmText="Supprimer"
                cancelText="Annuler"
                type="danger"
            />
        </div>
    );
};

export default StudentManager;
import React, { useState, useEffect } from 'react';
import { useSubjects } from '../../../hooks/useSubjects';
import { useJournal } from '../../../hooks/useJournal';
import { Plus, Trash2, BookOpen, Loader2, Edit2, Check, X } from 'lucide-react';
import './SubjectManager.scss';

const SubjectManager = () => {
    const { currentJournal } = useJournal();
    const { subjects, loading, loadSubjects, addSubject, removeSubject, updateSubject } = useSubjects();

    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#3b82f6');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // États pour l'édition
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    useEffect(() => {
        if (currentJournal?.id) {
            loadSubjects(currentJournal.id);
        }
    }, [currentJournal?.id, loadSubjects]);

    const cancelEdit = () => {
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newName.trim() || !currentJournal?.id) return;
        setIsSubmitting(true);
        try {
            await addSubject({ name: newName.trim(), color_code: newColor, journal_id: currentJournal.id });
            setNewName('');
            await loadSubjects(currentJournal.id);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (subject) => {
        setEditingId(subject.id);
        setEditName(subject.name);
        setEditColor(subject.color_code);
    };

    const handleUpdate = async (id) => {
        if (!editName.trim()) return;
        try {
            await updateSubject(id, { name: editName.trim(), color_code: editColor });
            setEditingId(null);
            await loadSubjects(currentJournal.id);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="subject-manager">
            {editingId && <div className="edit-overlay" onClick={cancelEdit} />}

            <div className="header-section">
                <h2><BookOpen size={24} /> Matières</h2>
                <p className="subtitle">Organisez vos enseignements</p>
            </div>

            <div className="main-grid">
                <div className="card">
                    <h3>Ajouter une matière</h3>
                    <form onSubmit={handleSubmit} className="subject-form">
                        <div className="input-wrapper">
                            <label>Nom</label>
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                        </div>
                        <div className="input-wrapper">
                            <label>Couleur</label>
                            <div className="color-selector">
                                <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
                                <span>{newColor.toUpperCase()}</span>
                            </div>
                        </div>
                        <button type="submit" className="btn-submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            Ajouter
                        </button>
                    </form>
                </div>

                <div className="card">
                    <h3>Liste des matières</h3>
                    <div className="table-responsive">
                        <table className="prolixe-table">
                            <thead>
                            <tr>
                                <th>Matière</th>
                                <th style={{ width: '100px' }}>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {subjects.map(subject => (
                                <tr key={subject.id} className={editingId === subject.id ? 'is-editing-row' : ''}>
                                    <td>
                                        {editingId === subject.id ? (
                                            <div className="edit-mode-content">
                                                <div className="color-picker-mini" style={{ '--selected-color': editColor }}>
                                                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                                                </div>
                                                <input
                                                    className="edit-input"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdate(subject.id);
                                                        if (e.key === 'Escape') cancelEdit();
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="color-dot" style={{ backgroundColor: subject.color_code }}></span>
                                                {subject.name}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {editingId === subject.id ? (
                                                <>
                                                    <button onClick={() => handleUpdate(subject.id)} className="action-btn save"><Check size={16} /></button>
                                                    <button onClick={cancelEdit} className="action-btn cancel"><X size={16} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleEditClick(subject)} className="btn-delete"><Edit2 size={16} /></button>
                                                    <button onClick={() => removeSubject(subject.id)} className="btn-delete"><Trash2 size={16} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubjectManager;
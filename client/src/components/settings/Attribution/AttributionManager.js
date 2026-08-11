import React, { useState, useEffect } from 'react';
import AttributionService from '../../../services/AttributionService';
import { useSchoolYears } from "../../../hooks/useSchoolYear";
import { useToast } from '../../../hooks/useToast';
import ConfirmModal from '../../ConfirmModal';
import SchoolYearDisplay from '../../../hooks/SchoolYearDisplay';
import { format } from 'date-fns';
import { Briefcase, Plus, X, Pencil, Trash2, Copy } from 'lucide-react'; // Imports icônes pour le look moderne
import './AttributionManager.scss';

// L'API renvoie déjà des dates 'YYYY-MM-DD' (pool mysql2 en dateStrings).
// On évite le détour par new Date(), qui les interprète en UTC et peut
// décaler d'un jour la valeur affichée dans un input type="date".
const toInputDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    return format(new Date(value), 'yyyy-MM-dd');
};

const FORM_TITLES = {
    create: 'Nouvelle attribution',
    edit: 'Modifier',
    duplicate: 'Dupliquer'
};

const AttributionManager = () => {
    const { schoolYears, loading: schoolYearsLoading } = useSchoolYears();
    const [attributions, setAttributions] = useState([]);
    const [attributionsLoading, setAttributionsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState('create'); // 'create' | 'edit' | 'duplicate'
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null });

    const [formData, setFormData] = useState({
        school_year_id: '',
        school_name: '',
        start_date: '',
        end_date: '',
        esi_hours: 0,
        ess_hours: 0,
        className: ''
    });

    const { success, error } = useToast();

    const fetchAttributions = async () => {
        setAttributionsLoading(true);
        try {
            const response = await AttributionService.getAttributions();
            setAttributions(response.data);
        } catch (err) {
            error('Erreur de chargement des attributions.');
        } finally {
            setAttributionsLoading(false);
        }
    };

    useEffect(() => { fetchAttributions(); }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Champs du formulaire déduits d'une attribution existante, sans son id :
    // c'est la présence de l'id qui fait basculer AttributionService entre
    // PUT (mise à jour) et POST (création).
    const formFieldsFrom = (attribution) => ({
        school_year_id: attribution.school_year_id,
        school_name: attribution.school_name,
        start_date: toInputDate(attribution.start_date),
        end_date: toInputDate(attribution.end_date),
        className: attribution.class || '',
        esi_hours: attribution.esi_hours || 0,
        ess_hours: attribution.ess_hours || 0,
    });

    const handleAddNew = () => {
        setFormMode('create');
        setFormData({ school_year_id: '', school_name: '', start_date: '', end_date: '', esi_hours: 0, ess_hours: 0, className: '' });
        setShowForm(true);
    };

    const handleEdit = (attribution) => {
        setFormMode('edit');
        setFormData({ id: attribution.id, ...formFieldsFrom(attribution) });
        setShowForm(true);
    };

    // Duplication : on pré-remplit le formulaire avec les données de la source
    // mais sans id, donc rien n'est écrit en base tant que l'utilisateur n'a
    // pas validé. Annuler ne laisse aucune attribution orpheline.
    const handleDuplicate = (attribution) => {
        setFormMode('duplicate');
        setFormData(formFieldsFrom(attribution));
        setShowForm(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (new Date(formData.start_date) >= new Date(formData.end_date)) {
            error("La date de fin doit être postérieure à la date de début.");
            return;
        }
        try {
            await AttributionService.saveAttribution(formData);
            success(formMode === 'duplicate' ? 'Attribution dupliquée.' : 'Attribution sauvegardée.');
            setShowForm(false);
            fetchAttributions();
        } catch (err) {
            error(err.message || 'Erreur lors de la sauvegarde.');
        }
    };

    const handleDelete = (attribution) => {
        setConfirmModal({
            isOpen: true,
            title: 'Supprimer l\'attribution',
            message: `Supprimer l'attribution pour ${attribution.school_name} ?`,
            onConfirm: async () => {
                try {
                    await AttributionService.deleteAttribution(attribution.id);
                    success('Supprimé avec succès.');
                    fetchAttributions();
                } catch (err) { error(err.message); }
                closeConfirmModal();
            }
        });
    };

    const closeConfirmModal = () => setConfirmModal({ isOpen: false, onConfirm: null });

    const groupedAttributions = attributions.reduce((acc, curr) => {
        const yearId = curr.school_year_id || 'unknown';
        (acc[yearId] = acc[yearId] || []).push(curr);
        return acc;
    }, {});

    const sortedGroupKeys = Object.keys(groupedAttributions).sort((a, b) => b - a);

    if (attributionsLoading || schoolYearsLoading) {
        return <div className="state-message">Chargement...</div>;
    }

    return (
        <div className="attribution-manager">
            <div className="manager-header">
                <div className="title-wrapper">
                    <div className="icon-box"><Briefcase size={24} color="white" /></div>
                    <div>
                        <h2>Mes Attributions</h2>
                        <p>Gérez vos informations professionnelles et contrats.</p>
                    </div>
                </div>
                <button className="add-attribution-btn" onClick={handleAddNew}>
                    <Plus size={18} /> Ajouter
                </button>
            </div>

            {showForm && (
                <div className="glass-modal-overlay">
                    <div className="glass-modal">
                        <h3>{FORM_TITLES[formMode]}</h3>
                        <form onSubmit={handleSave} className="attribution-form">
                            {/* Section Année Scolaire */}
                            <div className="input-group">
                                <label htmlFor="school_year_id">Année scolaire</label>
                                <select
                                    id="school_year_id"
                                    name="school_year_id"
                                    value={formData.school_year_id}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">-- Choisir une période --</option>
                                    {schoolYears.map(sy => (
                                        <option key={sy.id} value={sy.id}>
                                            {new Date(sy.start_date).getFullYear()} - {new Date(sy.end_date).getFullYear()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Section École et Classe */}
                            <div className="grid-row">
                                <div className="input-group flex-2">
                                    <label htmlFor="school_name">École</label>
                                    <input
                                        id="school_name"
                                        name="school_name"
                                        type="text"
                                        value={formData.school_name}
                                        onChange={handleFormChange}
                                        placeholder="Ex: ISLW"
                                        required
                                    />
                                </div>
                                <div className="input-group flex-1">
                                    <label htmlFor="className">Classe / Cours</label>
                                    <input
                                        id="className"
                                        name="className"
                                        type="text"
                                        value={formData.className}
                                        onChange={handleFormChange}
                                        placeholder="Ex: 3TTINFO"
                                    />
                                </div>
                            </div>

                            {/* Dates de l'attribution */}
                            <div className="div-container">
                                <div className="input-group">
                                    <label htmlFor="start_date">Date de début</label>
                                    <input
                                        id="start_date"
                                        name="start_date"
                                        type="date"
                                        value={formData.start_date}
                                        onChange={handleFormChange}
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="end_date">Date de fin</label>
                                    <input
                                        id="end_date"
                                        name="end_date"
                                        type="date"
                                        value={formData.end_date}
                                        onChange={handleFormChange}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Heures (Important : type="number") */}
                            <div className="div-container">
                                <div className="input-group">
                                    <label htmlFor="esi_hours">Heures ESI</label>
                                    <input
                                        id="esi_hours"
                                        name="esi_hours"
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={formData.esi_hours}
                                        onChange={handleFormChange}
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="ess_hours">Heures ESS</label>
                                    <input
                                        id="ess_hours"
                                        name="ess_hours"
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={formData.ess_hours}
                                        onChange={handleFormChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>
                                    Annuler
                                </button>
                                <button type="submit" className="confirm-btn">
                                    Sauvegarder l'attribution
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="attribution-list">
                {sortedGroupKeys.map(yearId => (
                    <div key={yearId} className="year-group">
                        <h4 className="year-title"><SchoolYearDisplay schoolYearId={yearId} /></h4>
                        {groupedAttributions[yearId].map(item => (
                            <div className="attribution-item" key={item.id}>
                                <div className="item-details">
                                    <strong>{item.school_name} {item.class && ` - ${item.class}`}</strong>
                                    <p>Du {format(new Date(item.start_date), 'dd/MM/yyyy')} au {format(new Date(item.end_date), 'dd/MM/yyyy')}</p>
                                    <p className="hours-pill">ESI: {item.esi_hours}h | ESS: {item.ess_hours}h</p>
                                </div>
                                <div className="item-actions">
                                    <button className="btn-edit" title="Modifier" onClick={() => handleEdit(item)}><Pencil size={16}/></button>
                                    <button className="btn-duplicate" title="Dupliquer" onClick={() => handleDuplicate(item)}><Copy size={16}/></button>
                                    <button className="btn-delete" title="Supprimer" onClick={() => handleDelete(item)}><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onClose={closeConfirmModal}
                onConfirm={confirmModal.onConfirm}
                type="danger"
            />
        </div>
    );
};

export default AttributionManager;
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import HolidaysManagerService from '../../../services/HolidaysManagerService';
import SchoolYearService from '../../../services/SchoolYearService';
import { useToast } from '../../../hooks/useToast';
import {CalendarDays} from "lucide-react";

import './HolidaysManager.scss';

const HolidaysManager = () => {
    const { user } = useAuth();
    const { success: showSuccess, error: showError } = useToast();

    const [schoolYears, setSchoolYears] = useState([]);
    const [selectedYearId, setSelectedYearId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Charger les années scolaires
    const fetchYears = useCallback(async () => {
        try {
            const response = await SchoolYearService.getAll();
            if (response) {
                setSchoolYears(response);
            }
        } catch (err) {
            showError("Erreur lors du chargement des années.");
        }
    }, [showError]);

    useEffect(() => {
        fetchYears();
    }, [fetchYears]);

    const selectedYearData = schoolYears.find(y => y.id === parseInt(selectedYearId));

    const currentHolidays = selectedYearData?.holidays
        ? (typeof selectedYearData.holidays === 'string' ? JSON.parse(selectedYearData.holidays) : selectedYearData.holidays)
        : null;

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        // On vide le champ tout de suite : réimporter le même fichier doit
        // relancer un onChange.
        event.target.value = '';
        if (!file || !selectedYearId) return;

        const formData = new FormData();
        formData.append('holidaysFile', file);
        formData.append('schoolYearId', selectedYearId);

        try {
            setIsLoading(true);
            const result = await HolidaysManagerService.uploadHolidaysFile(formData);
            showSuccess(result?.message || 'Calendrier mis à jour avec succès.');
            await fetchYears(); // Rafraîchissement pour voir la pastille changer
        } catch (error) {
            showError(error?.response?.data?.message || "Erreur lors de l'importation.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="holidays-manager container-fluid">
            <div className="header-section">
                <h2> <CalendarDays /> Gestion des Congés Scolaires</h2>
                <p className="subtitle">Liez un calendrier (JSON ou PDF de l'école) aux années académiques</p>
            </div>

            <div className="main-grid">
                {/* Colonne Gauche : Liste et Sélection */}
                <div className="config-card card">
                    <h3>Configuration</h3>

                    <div className="custom-select-wrapper">
                        <label>Choisir l'année académique</label>
                        <select
                            className="prolixe-select"
                            value={selectedYearId}
                            onChange={(e) => setSelectedYearId(e.target.value)}
                        >
                            <option value="">-- Sélectionner une année --</option>
                            {schoolYears.map(year => (
                                <option key={year.id} value={year.id}>
                                    {new Date(year.start_date).getFullYear()} - {new Date(year.end_date).getFullYear()}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedYearId && user?.role === 'ADMIN' && (
                        <div className="upload-box">
                            <input
                                id="file-upload"
                                type="file"
                                accept=".json,.pdf,application/json,application/pdf"
                                onChange={handleFileChange}
                                disabled={isLoading}
                            />
                            <label htmlFor="file-upload" className="btn-upload">
                                {isLoading ? 'Traitement...' : '📤 Remplacer le calendrier'}
                            </label>
                            <p className="upload-hint">Formats acceptés : .json ou le .pdf du calendrier scolaire</p>
                        </div>
                    )}

                    <div className="status-summary">
                        <h4>Statut des imports :</h4>
                        <ul>
                            {schoolYears.map(year => (
                                <li key={year.id} className={year.holidays ? 'status-done' : 'status-empty'}>
                                    <span className="dot"></span>
                                    {year.start_date} - {year.end_date} :
                                     <strong> {year.holidays ? 'Configuré' : 'Non configuré'}</strong>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Colonne Droite : Visualisation */}
                <div className="view-card card">
                    <h3>Aperçu des congés</h3>
                    {currentHolidays ? (
                        <div className="table-responsive">
                            <table className="prolixe-table">
                                <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Début</th>
                                    <th>Fin</th>
                                </tr>
                                </thead>
                                <tbody>
                                {currentHolidays.map((h, i) => (
                                    <tr key={i}>
                                        <td>{h.name}</td>
                                        <td>{new Date(h.start).toLocaleDateString()}</td>
                                        <td>{new Date(h.end).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>{selectedYearId ? "Aucun calendrier importé pour cette année." : "Sélectionnez une année pour voir les détails."}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HolidaysManager;

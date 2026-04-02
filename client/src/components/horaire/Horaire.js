// frontend/src/components/Horaire.js
import React, { useEffect, useMemo, useState } from 'react';
import { useScheduleHours } from '../../hooks/useScheduleHours';
import { useSchedule } from '../../hooks/useSchedule';
import { useJournal } from "../../hooks/useJournal";
import './Horaire.scss';
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Loader2,
    ChevronDown,
    AlertCircle
} from "lucide-react";

const ALL_DAYS = [
    { id: 1, name: 'Lundi' },
    { id: 2, name: 'Mardi' },
    { id: 3, name: 'Mercredi' },
    { id: 4, name: 'Jeudi' },
    { id: 5, name: 'Vendredi' },
    { id: 6, name: 'Samedi' }
];

const Horaire = () => {
    const { currentJournal } = useJournal();
    const journalId = currentJournal?.id;
    const [selectedSetId, setSelectedSetId] = useState("");

    const {
        slots,
        availableSets,
        loading: scheduleLoading,
        fetchSlots,
        fetchAllSets
    } = useSchedule(selectedSetId);

    const { hours, loading: hoursLoading } = useScheduleHours();

    useEffect(() => {
        if (!journalId) return;
        const init = async () => {
            const result = await fetchAllSets(journalId);
            const setsArray = result?.data || result;
            if (Array.isArray(setsArray) && setsArray.length > 0) {
                setSelectedSetId(setsArray[setsArray.length - 1].id);
            }
        };
        init();
    }, [fetchAllSets, journalId]);

    useEffect(() => {
        if (selectedSetId) fetchSlots();
    }, [selectedSetId, fetchSlots]);

    const activeDays = useMemo(() => {
        if (!slots || Object.keys(slots).length === 0) return ALL_DAYS;
        return ALL_DAYS.filter(day => Object.keys(slots).some(key => key.startsWith(`${day.id}-`)));
    }, [slots]);

    const sortedHours = useMemo(() => {
        return [...hours].sort((a, b) => a.libelle.localeCompare(b.libelle));
    }, [hours]);

    const setsList = useMemo(() => {
        return Array.isArray(availableSets?.data) ? availableSets.data : (Array.isArray(availableSets) ? availableSets : []);
    }, [availableSets]);

    const gridStyle = {
        gridTemplateColumns: `60px repeat(${activeDays.length}, minmax(140px, 1fr))`
    };

    if (hoursLoading || (!selectedSetId && scheduleLoading)) {
        return (
            <div className="horaire-loader-container">
                <Loader2 className="spinner" size={32} />
                <span>Chargement de l'emploi du temps...</span>
            </div>
        );
    }

    return (
        <div className="horaire-container">
            <header className="horaire-header">
                <div className="title-wrapper">
                    <Calendar className="header-icon" />
                    <h1>Emploi du Temps</h1>
                </div>

                <div className="select-container">
                    <div className="custom-select-wrapper">
                        <select
                            value={selectedSetId}
                            onChange={(e) => setSelectedSetId(e.target.value)}
                            className="custom-select"
                        >
                            <option value="">Choisir un planning...</option>
                            {setsList.map(set => (
                                <option key={set.id} value={set.id}>
                                    {set.name || set.libelle || `Horaire #${set.id}`}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="select-arrow" />
                    </div>
                </div>
            </header>

            <div className="horaire-grid-card">
                <div className="grid-responsive-wrapper">
                    <div className="horaire-grid" style={gridStyle}>
                        <div className="grid-header-cell corner"><Clock size={18} /></div>
                        {activeDays.map(day => (
                            <div key={day.id} className="grid-header-cell day-header">
                                <span className="day-full">{day.name}</span>
                            </div>
                        ))}

                        {sortedHours.map((hour) => (
                            <React.Fragment key={hour.id}>
                                <div className="time-label-cell">{hour.libelle}</div>
                                {activeDays.map((day) => {
                                    const assignment = slots[`${day.id}-${hour.id}`];

                                    // --- DEFINITION DES COULEURS ---
                                    const c = assignment?.color || assignment?.subject_color || '#0d9488';

                                    return (
                                        <div key={`${day.id}-${hour.id}`} className="slot-cell">
                                            {assignment ? (
                                                <div
                                                    className="assignment-card"
                                                    style={{
                                                        '--course-color': c,
                                                        '--course-bg': `${c}15`,       // Couleur à 8% opacité
                                                        '--course-bg-hover': `${c}25`, // Couleur à 15% opacité
                                                        '--course-glow': `${c}40`,     // Lueur douce
                                                    }}
                                                >
                                                    <div className="subject-name">{assignment.subject_name}</div>
                                                    <div className="assignment-meta">
                                                        <span className="meta-item"><MapPin size={10} /> {assignment.room || '-'}</span>
                                                        <span className="meta-item"><User size={10} /> {assignment.class_name || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="empty-mark"></span>
                                            )}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Horaire;
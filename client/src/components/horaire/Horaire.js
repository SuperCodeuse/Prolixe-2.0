// frontend/src/components/Horaire.js
import React, { useEffect, useMemo, useState } from 'react';
import { useScheduleHours } from '../../hooks/useScheduleHours';
import { useSchedule } from '../../hooks/useSchedule';
import { useJournal } from "../../hooks/useJournal";
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA } from '../../utils/breakpoints';
import './Horaire.scss';
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Loader2,
    ChevronDown
} from "lucide-react";

const ALL_DAYS = [
    { id: 1, name: 'Lundi', short: 'Lun' },
    { id: 2, name: 'Mardi', short: 'Mar' },
    { id: 3, name: 'Mercredi', short: 'Mer' },
    { id: 4, name: 'Jeudi', short: 'Jeu' },
    { id: 5, name: 'Vendredi', short: 'Ven' },
    { id: 6, name: 'Samedi', short: 'Sam' }
];

// Couleurs dérivées de la matière, partagées par les deux vues.
const courseVars = (assignment) => {
    const c = assignment?.color || assignment?.subject_color || '#0d9488';
    return {
        '--course-color': c,
        '--course-bg': `${c}15`,
        '--course-bg-hover': `${c}25`,
        '--course-glow': `${c}40`,
    };
};

const Horaire = () => {
    const { currentJournal } = useJournal();
    const journalId = currentJournal?.id;
    const [selectedSetId, setSelectedSetId] = useState("");

    const isMobile = useMediaQuery(MEDIA.mobile);

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

    // Les libellés sont au format HH:MM-HH:MM, mais la validation côté serveur
    // accepte aussi « 8:30 ». Un tri texte placerait alors 10:00 avant 8:30 :
    // on compare donc les minutes du début de créneau.
    const sortedHours = useMemo(() => {
        const startMinutes = (libelle) => {
            const [h, m] = String(libelle || '').split('-')[0].split(':');
            const minutes = Number(h) * 60 + Number(m);
            return Number.isFinite(minutes) ? minutes : Number.MAX_SAFE_INTEGER;
        };
        return [...hours].sort((a, b) => startMinutes(a.libelle) - startMinutes(b.libelle));
    }, [hours]);

    const setsList = useMemo(() => {
        return Array.isArray(availableSets?.data) ? availableSets.data : (Array.isArray(availableSets) ? availableSets : []);
    }, [availableSets]);

    // Vue mobile : un jour à la fois, celui du jour par défaut.
    const [selectedDayId, setSelectedDayId] = useState(() => {
        const today = new Date().getDay();
        return today >= 1 && today <= 6 ? today : 1;
    });

    useEffect(() => {
        if (activeDays.length === 0) return;
        if (!activeDays.some(day => day.id === selectedDayId)) {
            setSelectedDayId(activeDays[0].id);
        }
    }, [activeDays, selectedDayId]);

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

    const selectedDay = activeDays.find(day => day.id === selectedDayId) || activeDays[0];
    const daySlots = selectedDay
        ? sortedHours.map(hour => ({ hour, assignment: slots[`${selectedDay.id}-${hour.id}`] }))
        : [];
    const dayHasCourse = daySlots.some(entry => entry.assignment);

    return (
        <div className="horaire-container">
            <header className="horaire-header">
                <div className="title-wrapper">
                    <Calendar className="header-icon" />
                    <h1>Emploi du Temps</h1>
                </div>

                <div className="select-container">
                    <div className="custom-select-wrapper">
                        <label className="sr-only" htmlFor="horaire-set">Planning affiché</label>
                        <select
                            id="horaire-set"
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

            {isMobile ? (
                <>
                    <div className="day-tabs" role="tablist" aria-label="Jour affiché">
                        {activeDays.map(day => (
                            <button
                                key={day.id}
                                type="button"
                                role="tab"
                                aria-selected={day.id === selectedDayId}
                                className={`day-tab${day.id === selectedDayId ? ' active' : ''}`}
                                onClick={() => setSelectedDayId(day.id)}
                            >
                                {day.short}
                            </button>
                        ))}
                    </div>

                    <div className="horaire-day-list">
                        {!dayHasCourse && (
                            <p className="day-empty">Aucun cours {selectedDay ? `le ${selectedDay.name.toLowerCase()}` : 'ce jour'}.</p>
                        )}

                        {dayHasCourse && daySlots.map(({ hour, assignment }) => (
                            <div
                                key={hour.id}
                                className={`day-row${assignment ? ' has-course' : ' is-free'}`}
                                style={assignment ? courseVars(assignment) : undefined}
                            >
                                <span className="day-row-time">{hour.libelle}</span>

                                {assignment ? (
                                    <div className="day-row-body">
                                        <div className="subject-name">{assignment.subject_name}</div>
                                        <div className="assignment-meta">
                                            <span className="meta-item"><MapPin size={12} aria-hidden="true" /> {assignment.room || '—'}</span>
                                            <span className="meta-item"><User size={12} aria-hidden="true" /> {assignment.class_name || 'N/A'}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="day-row-free">Libre</span>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            ) : (
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

                                        return (
                                            <div key={`${day.id}-${hour.id}`} className="slot-cell">
                                                {assignment ? (
                                                    <div className="assignment-card" style={courseVars(assignment)}>
                                                        <div className="subject-name">{assignment.subject_name}</div>
                                                        <div className="assignment-meta">
                                                            <span className="meta-item"><MapPin size={10} aria-hidden="true" /> {assignment.room || '-'}</span>
                                                            <span className="meta-item"><User size={10} aria-hidden="true" /> {assignment.class_name || 'N/A'}</span>
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
            )}
        </div>
    );
};

export default Horaire;

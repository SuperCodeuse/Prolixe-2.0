import React, { useState, useEffect } from 'react';
import './Horaire.scss';
import { useClasses } from "../../hooks/useClasses";
import { useScheduleHours } from "../../hooks/useScheduleHours";
import { useToast } from '../../hooks/useToast';
import Toast from "../Toast";
import ConfirmModal from '../ConfirmModal';
import { useSchedule } from '../../hooks/useSchedule';
import { useJournal } from "../../hooks/useJournal";
import useScheduleModel from '../../hooks/useScheduleModel';
import moment from 'moment';

const Horaire = () => {
    const { currentJournal } = useJournal();
    const journalId = currentJournal?.id;
    const { classes, getClassColor } = useClasses(journalId);

    const { hours, getSortedHours, loading: loadingHours, error: errorHours } = useScheduleHours();
    const { success, error: showError, toasts, removeToast } = useToast();
    const { schedules, loading: loadingScheduleModels, error: errorScheduleModels, fetchSchedules } = useScheduleModel(journalId);

    const [selectedScheduleId, setSelectedScheduleId] = useState(null);
    const [newScheduleName, setNewScheduleName] = useState('');

    const {
        schedule,
        loading: loadingSchedule,
        error: errorSchedule,
        upsertCourse,
        deleteCourse: deleteCourseFromHook,
        getCourseBySlotKey,
        changeCourse,
        fetchSchedule
    } = useSchedule(selectedScheduleId); // Passer l'ID du planning au hook

    const [showModal, setShowModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [courseForm, setCourseForm] = useState({
        subject: '',
        classId: '',
        room: '',
        notes: ''
    });

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [draggedCourse, setDraggedCourse] = useState(null);
    const [dragOverSlot, setDragOverSlot] = useState(null);
    const [resizeHandle, setResizeHandle] = useState(null);
    const [resizingCourse, setResizingCourse] = useState(null);

/*
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
*/
    // Gérer la sélection du premier emploi du temps par défaut
    useEffect(() => {
        if (schedules && schedules.length > 0) {
            // Tri les emplois du temps par ID pour s'assurer que le plus récent est en tête
            const sortedSchedules = [...schedules].sort((a, b) => b.id - a.id);
            if (!selectedScheduleId || !schedules.some(s => s.id === selectedScheduleId)) {
                setSelectedScheduleId(sortedSchedules[0].id);
            }
        }
    }, [schedules, selectedScheduleId, fetchSchedule]);


    const subjects = ['TIC', 'Info', 'Exp.logiciels', 'Txt', 'Labo Phys.', 'Labo Ch.', 'Chimie', 'Physique', 'Sciences 3H', 'Sciences'];
    const timeSlots = getSortedHours().map(hour => hour.libelle);

    const daysOfWeek = [
        { key: 'monday', label: 'Lundi' },
        { key: 'tuesday', label: 'Mardi' },
        { key: 'wednesday', label: 'Mercredi' },
        { key: 'thursday', label: 'Jeudi' },
        { key: 'friday', label: 'Vendredi' }
    ];

    const getSlotIndex = (time_libelle) => {
        return timeSlots.findIndex(slot => slot === time_libelle);
    };

    const getAdjacentSlots = (day, time_libelle) => {
        const currentIndex = getSlotIndex(time_libelle);
        const prevSlot = currentIndex > 0 ? timeSlots[currentIndex - 1] : null;
        const nextSlot = currentIndex < timeSlots.length - 1 ? timeSlots[currentIndex + 1] : null;

        return {
            prev: prevSlot,
            next: nextSlot,
            prevAvailable: prevSlot && !getCourseBySlotKey(`${day}-${prevSlot}`),
            nextAvailable: nextSlot && !getCourseBySlotKey(`${day}-${nextSlot}`)
        };
    };

    const handleResizeStart = (e, direction, day, time_libelle) => {
        e.stopPropagation();
        setResizeHandle(direction);
        setResizingCourse({ day, time_libelle });

        const handleMouseMove = (moveEvent) => {
            // Logique de redimensionnement en temps réel
        };

        const handleMouseUp = () => {
            setResizeHandle(null);
            setResizingCourse(null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleResizeDrop = async (targetDay, targetTime, direction) => {
        if (!resizingCourse) return;

        try {
            const { day: sourceDay, time_libelle: sourceTime } = resizingCourse;
            const sourceCourse = getCourseBySlotKey(`${sourceDay}-${sourceTime}`);

            if (!sourceCourse) {
                showError('Cours source introuvable.', 3000);
                return;
            }

            const targetSlotKey = `${targetDay}-${targetTime}`;
            if (getCourseBySlotKey(targetSlotKey)) {
                showError('Le créneau de destination est déjà occupé.', 3000);
                return;
            }

            const adjacentSlots = getAdjacentSlots(sourceDay, sourceTime);
            const isValidResize = (
                (direction === 'up' && targetTime === adjacentSlots.prev) ||
                (direction === 'down' && targetTime === adjacentSlots.next)
            ) && targetDay === sourceDay;

            if (!isValidResize) {
                showError('Vous ne pouvez étendre le cours que sur les créneaux adjacents.', 3000);
                return;
            }

            const targetTimeSlot = getSortedHours().find(h => h.libelle === targetTime);
            if (!targetTimeSlot) {
                showError('Créneau horaire invalide.', 3000);
                return;
            }

            await upsertCourse(targetDay, targetTime, {
                subject: sourceCourse.subject,
                classId: sourceCourse.classId,
                room: sourceCourse.room,
                notes: sourceCourse.notes || ''
            });

            success(`Cours étendu avec succès sur ${targetTime} !`, 3000);

        } catch (error) {
            console.error('Erreur lors de l\'extension du cours:', error);
            showError(`Erreur lors de l'extension: ${error?.message || 'Erreur inconnue'}`, 5000);
        }
    };
    const handleDragStart = (e, day, time_libelle) => {
        const slotKey = `${day}-${time_libelle}`;
        const course = getCourseBySlotKey(slotKey);

        if (course) {
            const dragData = {
                sourceDay: day,
                sourceTime: time_libelle,
                course: course
            };

            setDraggedCourse(dragData);
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
            e.dataTransfer.effectAllowed = 'move';

            const dragElement = e.currentTarget.cloneNode(true);
            dragElement.style.position = 'absolute';
            dragElement.style.top = '-1000px';
            dragElement.style.left = '-1000px';
            dragElement.style.width = e.currentTarget.offsetWidth + 'px';
            dragElement.style.height = e.currentTarget.offsetHeight + 'px';
            dragElement.style.opacity = '0.8';
            dragElement.style.transform = 'rotate(2deg)';
            dragElement.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
            dragElement.style.borderRadius = '6px';
            dragElement.style.zIndex = '1000';

            document.body.appendChild(dragElement);
            e.dataTransfer.setDragImage(dragElement, e.currentTarget.offsetWidth / 2, 20);

            setTimeout(() => {
                if (document.body.contains(dragElement)) {
                    document.body.removeChild(dragElement);
                }
            }, 0);

            e.currentTarget.classList.add('dragging');
        }
    };

    const handleDragEnd = (e) => {
        e.currentTarget.classList.remove('dragging');
        setDraggedCourse(null);
        setDragOverSlot(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (resizeHandle) {
            e.dataTransfer.dropEffect = 'copy';
        } else {
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleDragEnter = (e, day, time_libelle) => {
        e.preventDefault();
        const slotKey = `${day}-${time_libelle}`;

        if (draggedCourse && draggedCourse.sourceDay === day && draggedCourse.sourceTime === time_libelle) {
            return;
        }

        setDragOverSlot(slotKey);
    };

    const handleDragLeave = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverSlot(null);
        }
    };

    const handleDrop = async (e, targetDay, targetTime) => {
        e.preventDefault();
        setDragOverSlot(null);

        if (resizeHandle && resizingCourse) {
            await handleResizeDrop(targetDay, targetTime, resizeHandle);
            setResizeHandle(null);
            setResizingCourse(null);
            return;
        }

        try {
            const dragDataStr = e.dataTransfer.getData('application/json');
            if (!dragDataStr) return;

            const dragData = JSON.parse(dragDataStr);
            const { sourceDay, sourceTime, course } = dragData;

            if (sourceDay === targetDay && sourceTime === targetTime) {
                return;
            }

            const targetSlotKey = `${targetDay}-${targetTime}`;
            const existingCourse = getCourseBySlotKey(targetSlotKey);

            if (existingCourse) {
                showError('Le créneau de destination est déjà occupé.', 3000);
                return;
            }

            const sourceTimeSlot = getSortedHours().find(h => h.libelle === sourceTime);
            const targetTimeSlot = getSortedHours().find(h => h.libelle === targetTime);

            if (!sourceTimeSlot || !targetTimeSlot) {
                showError('Erreur: créneaux horaires invalides.', 3000);
                return;
            }

            const dataToSend = {
                source_day: sourceDay,
                source_time_slot_id: sourceTimeSlot.id,
                target_day: targetDay,
                target_time_slot_id: targetTimeSlot.id,

                // On ajoute les informations manquantes directement depuis l'objet 'course'
                subject: course.subject,
                classId: course.classId,
                room: course.room,
                notes: course.notes,
                journal_id: course.journal_id,
                schedule_set_id: course.schedule_set_id,
                effective_date: moment().format('YYYY-MM-DD')
            };

            await changeCourse(dataToSend);
            success('Cours déplacé avec succès !', 3000);

        } catch (error) {
            console.error('Erreur lors du déplacement:', error);
            showError(`Erreur lors du déplacement: ${error?.message || 'Erreur inconnue'}`, 5000);
        }
    };

    const handleSlotClick = (day, time_libelle) => {
        if (draggedCourse) return;

        const slotKey = `${day}-${time_libelle}`;
        setSelectedSlot({ day, time_libelle, key: slotKey });

        const existingCourse = getCourseBySlotKey(slotKey);
        if (existingCourse) {
            setCourseForm({
                subject: existingCourse.subject,
                classId: existingCourse.classId,
                room: existingCourse.room,
                notes: existingCourse.notes || ''
            });
        } else {
            setCourseForm({
                subject: '',
                classId: '',
                room: '21',
                notes: ''
            });
        }
        setShowModal(true);
    };

    const handleSaveCourse = async () => {
        if (!courseForm.subject || !courseForm.classId || !courseForm.room) {
            showError('Veuillez remplir tous les champs obligatoires (Matière, Classe, Local).', 3000);
            return;
        }

        try {
            await upsertCourse(selectedSlot.day, selectedSlot.time_libelle, courseForm);
            success('Cours enregistré avec succès !', 3000);
            setShowModal(false);
            setCourseForm({ subject: '', classId: '', room: '', notes: '' });
        } catch (err) {
            console.error("Erreur lors de la sauvegarde du cours:", err);
            showError(`Erreur lors de l'enregistrement: ${(err && err.message) || String(err)}`, 5000);
        }
    };

    const showConfirmModal = (title, message, onConfirm) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal({
            isOpen: false,
            title: '',
            message: '',
            onConfirm: null
        });
    };

    const handleDeleteCourseConfirmation = () => {
        const course = getCourseBySlotKey(selectedSlot?.key);
        const classInfo = course ? getClassInfo(course.classId) : null;
        const className = classInfo?.name || 'inconnue';
        const courseSubject = course?.subject || 'ce cours';

        showConfirmModal(
            'Supprimer ce cours',
            `Êtes-vous sûr de vouloir supprimer le cours de "${courseSubject}" pour la classe "${className}" (${selectedSlot?.time_libelle}) ?\n\nCette action est irréversible.`,
            () => performDeleteCourse()
        );
    };

    const performDeleteCourse = async () => {
        try {
            await deleteCourseFromHook(selectedSlot.day, selectedSlot.time_libelle);
            success('Cours supprimé avec succès !', 3000);
            setShowModal(false);
            closeConfirmModal();
            setCourseForm({ subject: '', classId: '', room: '', notes: '' });
        } catch (err) {
            console.error("Erreur lors de la suppression du cours:", err);
            showError(`Erreur lors de la suppression: ${(err && err.message) || String(err)}`, 5000);
        }
    };

    const handleDuplicateSchedule = async () => {
        if (!newScheduleName.trim()) {
            showError('Veuillez donner un nom au nouvel emploi du temps.', 3000);
            return;
        }

        // 🔑 AJOUT DE LA LOGIQUE DE TOKEN
        const token = localStorage.getItem('authToken');
        if (!token) {
            showError("Erreur d'authentification: Jeton manquant. Veuillez vous reconnecter.", 5000);
            return;
        }

        try {
            // Définir des dates par défaut pour la création du modèle
            const currentDate = moment().format('YYYY-MM-DD');
            const defaultEndDate = moment().add(1, 'years').format('YYYY-MM-DD');

            // Créer un nouvel horaire vide
            const createResponse = await fetch('/api/schedules/models', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 🔑 ENVOI DU TOKEN DANS L'EN-TÊTE
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newScheduleName,
                    startDate: currentDate, // REQUIS PAR LE BACKEND
                    endDate: defaultEndDate,  // REQUIS PAR LE BACKEND
                    typeBody: "PERSONNAL",
                }),
            });

            if (!createResponse.ok) {
                let errorMessage = `Échec de la création (Statut ${createResponse.status}).`;
                try {
                    const errorBody = await createResponse.json();
                    errorMessage = errorBody.message || errorMessage;
                } catch (e) { /* Non-JSON response */ }
                showError(errorMessage, 5000);
                return;
            }

            const newSchedule = await createResponse.json();
            const newScheduleId = newSchedule.scheduleId;

            if (!newScheduleId) {
                console.error("Réponse de création d'horaire inattendue:", newSchedule);
                showError('ID du nouvel emploi du temps non trouvé dans la réponse (clé attendue: "scheduleId").', 5000);
                return;
            }

            // Dupliquer l'horaire sélectionné dans le nouveau
            const duplicateResponse = await fetch('/api/schedule/duplicate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // ENVOI DU TOKEN
                },
                body: JSON.stringify({
                    source_schedule_set_id: selectedScheduleId,
                    target_schedule_set_id: newScheduleId, // Utilisation de l'ID corrigé
                    journal_id: journalId,
                }),
            });
            if (duplicateResponse.ok) {
                success('Emploi du temps dupliqué avec succès !', 3000);
                setNewScheduleName('');
                await fetchSchedules(); // Actualiser la liste des emplois du temps
                setSelectedScheduleId(newScheduleId); // Sélectionner le nouvel horaire
            } else {
                const errorBody = await duplicateResponse.json();
                showError(`Erreur lors de la duplication: ${errorBody?.message || duplicateResponse.statusText}`, 5000);
            }

        } catch (error) {
            console.error("Erreur lors de la duplication de l'emploi du temps:", error);
            showError(`Erreur lors de la duplication: ${error?.message || 'Erreur inconnue'}`, 5000);
        }
    };

    const getClassInfo = (classId) => {
        return classes.find(cls => cls.id == classId);
    };

    if (loadingHours || loadingScheduleModels || loadingSchedule) {
        return (
            <div className="horaire">
                <div className="loading-message">
                    Chargement de l'emploi du temps...
                </div>
            </div>
        );
    }

    if (errorHours || errorScheduleModels || errorSchedule) {
        return (
            <div className="horaire">
                <div className="error-message">
                    Erreur de chargement: {(errorHours && errorHours.message) || (errorScheduleModels && errorScheduleModels.message) || (errorSchedule && errorSchedule.message) || "Une erreur inconnue est survenue."}
                </div>
            </div>
        );
    }

    const allSlots = daysOfWeek.flatMap(day =>
        timeSlots.map(time_libelle => ({
            day: day.key,
            dayLabel: day.label,
            time: time_libelle,
            slotKey: `${day.key}-${time_libelle}`
        }))
    );

    return (
        <div className="horaire">
            <div className="horaire-header">
                <h1>📅 Emploi du temps</h1>
                <p>Cliquez sur un créneau pour ajouter/modifier - Glissez-déposez pour déplacer un cours</p>
                {/* Sélecteur d'emplois du temps */}

                <div className="schedule-selector-container">
                    <div className="form-group">
                        <label htmlFor="schedule-select">Sélectionner un emploi du temps :</label>
                        <select
                            id="schedule-select"
                            value={selectedScheduleId || ''}
                            onChange={(e) => setSelectedScheduleId(parseInt(e.target.value))}
                            className="form-control btn-select"
                        >
                            {schedules.length > 0 ? (
                                schedules.map(scheduleModel => (
                                    <option key={scheduleModel.id} value={scheduleModel.id}>
                                        {scheduleModel.name}
                                    </option>
                                ))
                            ) : (
                                <option value="" disabled>Aucun emploi du temps trouvé</option>
                            )}
                        </select>
                    </div>
                    {/* Duplication de l'horaire */}
                    {selectedScheduleId && (
                        <div className="duplicate-schedule-container form-group">
                            <input
                                type="text"
                                className="form-control input-group-sm"
                                placeholder="Nom du nouvel horaire"
                                value={newScheduleName}
                                onChange={(e) => setNewScheduleName(e.target.value)}
                            />
                            <button
                                className="btn-secondary btn-select"
                                onClick={handleDuplicateSchedule}
                                disabled={!newScheduleName.trim()}
                            >
                                Dupliquer
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="schedule-container">
                {!isMobile && (
                    <div className="schedule-grid desktop-grid">
                        <div className="time-header">Horaires</div>
                        {daysOfWeek.map(day => (
                            <div key={day.key} className="day-header">
                                {day.label}
                            </div>
                        ))}

                        {timeSlots.map(time_libelle => (
                            <React.Fragment key={time_libelle}>
                                <div className="time-slot-label">{time_libelle}</div>
                                {daysOfWeek.map(day => {
                                    const slotKey = `${day.key}-${time_libelle}`;
                                    const course = getCourseBySlotKey(slotKey);
                                    const classInfo = course ? getClassInfo(course.classId) : null;
                                    const isDragOver = dragOverSlot === slotKey;
                                    const adjacentSlots = course ? getAdjacentSlots(day.key, time_libelle) : null;

                                    return (
                                        <div
                                            key={slotKey}
                                            className={`schedule-slot ${course ? 'has-course' : 'empty'} ${isDragOver ? 'drag-over' : ''}`}
                                            onClick={() => handleSlotClick(day.key, time_libelle)}
                                            draggable={!!course}
                                            onDragStart={(e) => course && handleDragStart(e, day.key, time_libelle)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDragEnter={(e) => handleDragEnter(e, day.key, time_libelle)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, day.key, time_libelle)}
                                            style={{
                                                backgroundColor: course ? `${getClassColor(course.subject, classInfo?.level)}20` : 'transparent',
                                                borderColor: course ? getClassColor(course.subject, classInfo?.level) : '#334155',
                                                cursor: course ? 'grab' : 'pointer'
                                            }}
                                        >
                                            {course && (
                                                <div className="course-info">
                                                    {adjacentSlots?.prevAvailable && (
                                                        <div
                                                            className="resize-handle resize-handle-top"
                                                            onMouseDown={(e) => handleResizeStart(e, 'up', day.key, time_libelle)}
                                                            title="Étendre vers le créneau précédent"
                                                        >
                                                            <div className="resize-indicator">⇈</div>
                                                        </div>
                                                    )}

                                                    <div className="course-subject">{course.subject}</div>
                                                    <div className="course-class">{classInfo?.name}</div>
                                                    <div className="course-room">{course.room}</div>

                                                    {adjacentSlots?.nextAvailable && (
                                                        <div
                                                            className="resize-handle resize-handle-bottom"
                                                            onMouseDown={(e) => handleResizeStart(e, 'down', day.key, time_libelle)}
                                                            title="Étendre vers le créneau suivant"
                                                        >
                                                            <div className="resize-indicator">⇊</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!course && isDragOver && (
                                                <div className="drop-zone-indicator">
                                                    <div className="drop-zone-content">
                                                        <span className="drop-icon">📅</span>
                                                        <span>Déposer ici</span>
                                                    </div>
                                                </div>
                                            )}
                                            {!course && !isDragOver && (
                                                <div className="empty-slot">
                                                    <span>+ Ajouter un cours</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {isMobile && (
                    <div className="schedule-list mobile-list">
                        {allSlots.map(slot => {
                            const course = getCourseBySlotKey(slot.slotKey);
                            const classInfo = course ? getClassInfo(course.classId) : null;
                            const slotHasCourse = !!course;
                            const isDragOver = dragOverSlot === slot.slotKey;

                            return (
                                <div
                                    key={slot.slotKey}
                                    className={`schedule-list-item ${slotHasCourse ? 'has-course' : 'empty'} ${isDragOver ? 'drag-over' : ''}`}
                                    onClick={() => handleSlotClick(slot.day, slot.time)}
                                    draggable={slotHasCourse}
                                    onDragStart={(e) => slotHasCourse && handleDragStart(e, slot.day, slot.time)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={handleDragOver}
                                    onDragEnter={(e) => handleDragEnter(e, slot.day, slot.time)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, slot.day, slot.time)}
                                    style={{
                                        borderLeftColor: slotHasCourse ? getClassColor(course.subject, classInfo?.level) : 'var(--accent-blue)',
                                        cursor: slotHasCourse ? 'grab' : 'pointer'
                                    }}
                                >
                                    <div className="slot-header">
                                        <span className="slot-day">{slot.dayLabel}</span>
                                        <span className="slot-time">{slot.time}</span>
                                        {slotHasCourse && <span className="drag-indicator-mobile">⋮⋮</span>}
                                    </div>
                                    {slotHasCourse ? (
                                        <div className="course-info-mobile">
                                            <div className="course-subject">{course.subject}</div>
                                            <div className="course-details">
                                                <span className="course-class">{classInfo?.name}</span>
                                                <span className="course-room">
                                                    <i className="fas fa-map-marker-alt"></i> {course.room}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-slot-mobile">
                                            <span>Ajouter un cours</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>
                                {getCourseBySlotKey(selectedSlot?.key) ? 'Modifier le cours' : 'Ajouter un cours'}
                            </h3>
                            <button
                                className="modal-close"
                                onClick={() => setShowModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <form className="modal-form">
                            <div className="modal-body-content">
                                <div className="slot-info">
                                    <strong>
                                        {daysOfWeek.find(d => d.key === selectedSlot?.day)?.label} - {selectedSlot?.time_libelle}
                                    </strong>
                                </div>

                                <div className="form-group">
                                    <label>Matière *</label>
                                    <select
                                        value={courseForm.subject}
                                        onChange={(e) => setCourseForm({...courseForm, subject: e.target.value})}
                                    >
                                        <option value="">Sélectionnez une matière</option>
                                        {subjects.map(subject => (
                                            <option key={subject} value={subject}>
                                                {subject}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Classe *</label>
                                    <select
                                        value={courseForm.classId}
                                        onChange={(e) => setCourseForm({...courseForm, classId: e.target.value})}
                                    >
                                        <option value="">Sélectionnez une classe</option>
                                        {classes.map(cls => (
                                            <option key={cls.id} value={cls.id}>
                                                {cls.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Local *</label>
                                    <input
                                        type="text"
                                        value={courseForm.room}
                                        onChange={(e) => setCourseForm({...courseForm, room: e.target.value})}
                                        placeholder="Ex: Salle 101"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        value={courseForm.notes}
                                        onChange={(e) => setCourseForm({...courseForm, notes: e.target.value})}
                                        placeholder="Notes supplémentaires..."
                                        rows="3"
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Annuler
                                </button>
                                {getCourseBySlotKey(selectedSlot?.key) && (
                                    <button
                                        type="button"
                                        className="btn-danger"
                                        onClick={handleDeleteCourseConfirmation}
                                    >
                                        Supprimer
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={handleSaveCourse}
                                >
                                    Sauvegarder
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="toast-container">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        duration={toast.duration}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>

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

export default Horaire;
// client/src/components/Correction/CorrectionList.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getEvaluations, createEvaluation, updateEvaluation, deleteEvaluation, getEvaluationForGrading } from '../../services/EvaluationService';
import EvaluationModal from './EvaluationModal';
import ConfirmModal from '../ConfirmModal';
import { useToast } from '../../hooks/useToast';
import { useJournal } from '../../hooks/useJournal';
import './CorrectionList.scss';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CorrectionList = () => {
    const { currentJournal, loading: loadingJournal } = useJournal();
    // MODIFICATION 1 : Destructurer 'info' et 'removeToast'
    const { success, error: showError, info, removeToast } = useToast();

    const [evaluations, setEvaluations] = useState([]);
    const [loadingEvaluations, setLoadingEvaluations] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvaluation, setEditingEvaluation] = useState(null);
    const [evaluationToCopy, setEvaluationToCopy] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const fetchEvaluations = useCallback(async () => {
        if (!currentJournal?.id) {
            setEvaluations([]);
            setLoadingEvaluations(false);
            return;
        }

        setLoadingEvaluations(true);
        setError('');
        try {
            let response = await getEvaluations(currentJournal.id);
            response = response.data;
            setEvaluations(response.data || []);
        } catch (err) {
            const errorMessage = 'Impossible de charger les évaluations.';
            setError(errorMessage);
            showError(err.message || errorMessage);
        } finally {
            setLoadingEvaluations(false);
        }
    }, [currentJournal, showError]);

    useEffect(() => {
        fetchEvaluations();
    }, [fetchEvaluations]);

    const groupedEvaluations = useMemo(() => {
        const groups = {};
        evaluations.forEach(evalu => {
            const className = evalu.class_name || 'Sans classe';
            const folderName = evalu.folder || 'Sans dossier';
            if (!groups[className]) {
                groups[className] = {};
            }
            if (!groups[className][folderName]) {
                groups[className][folderName] = [];
            }
            groups[className][folderName].push(evalu);
        });

        // Tri pour un affichage stable
        const sortedClasses = Object.keys(groups).sort();
        const sortedGroups = {};
        sortedClasses.forEach(className => {
            const folders = Object.keys(groups[className]).sort();
            sortedGroups[className] = {};
            folders.forEach(folderName => {
                sortedGroups[className][folderName] = groups[className][folderName].sort((a, b) => new Date(b.evaluation_date) - new Date(a.evaluation_date));
            });
        });

        return sortedGroups;
    }, [evaluations]);

    const handleOpenCreateModal = () => {
        setEditingEvaluation(null);
        setEvaluationToCopy(null);
        setIsModalOpen(true);
    };

    const handleOpenCopyModal = (ev) => {
        setEditingEvaluation(null);
        setEvaluationToCopy(ev);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (ev) => {
        setEditingEvaluation(ev);
        setEvaluationToCopy(null);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (ev) => {
        setConfirmModal({
            isOpen: true,
            title: 'Confirmer la suppression',
            message: `Êtes-vous sûr de vouloir supprimer l'évaluation "${ev.name}" ? Cette action est irréversible.`,
            onConfirm: () => performDelete(ev.id),
        });
    };

    const performDelete = async (id) => {
        try {
            await deleteEvaluation(id);
            await fetchEvaluations();
            success('Évaluation supprimée.');
        } catch (err) {
            showError(err.message || 'Erreur de suppression');
        } finally {
            setConfirmModal({ isOpen: false });
        }
    };

    const handleSaveEvaluation = async (evaluationData) => {
        try {
            if (editingEvaluation) {
                await updateEvaluation(editingEvaluation.id, evaluationData);
                success('Évaluation mise à jour !');
            } else {
                await createEvaluation(evaluationData);
                success('Évaluation créée avec succès !');
            }
            await fetchEvaluations();
            setIsModalOpen(false);
            setEditingEvaluation(null);
            setEvaluationToCopy(null);
        } catch (err) {
            showError(err.message || "Erreur lors de la sauvegarde de l'évaluation");
        }
    };

    const handleExportPDF = async (evaluationId, evaluationName) => {
        // MODIFICATION 2 : Afficher une notification de chargement et capturer son ID
        const loadingToastId = info(`Exportation de "${evaluationName}" en cours... Cela peut prendre quelques instants.`, 60000); // 1 minute, on la retire manuellement

        try {
            let { data }= await getEvaluationForGrading(evaluationId);
            data = data.data;
            const evaluationData = data.evaluation;
            const students = data.students;
            const criteria = data.criteria;
            const grades = data.grades;

            // Fonction pour générer le HTML de commentaire formaté
            const formatCommentHtml = (text) => {
                if (!text) return '';

                // Fonction utilitaire pour échapper les caractères HTML
                const escapeHtml = (unsafe) => {
                    return unsafe.replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                };

                const parts = text.split(/(\/\*[\s\S]*?\*\/)/g).filter(Boolean);
                let html = '';

                parts.forEach((part) => {
                    if (part.startsWith('/*') && part.endsWith('*/')) {
                        const content = escapeHtml(part);
                        html += `<code style="font-family: 'Courier New', monospace; background-color: rgba(6, 182, 212, 0.1); padding: 2px 4px; border-radius: 3px; font-size: 0.8rem; word-break: break-all;">${content}</code><br/>`;
                    } else {
                        html += part.split('\n').map((line) => {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('#')) {
                                return `<b style="color: rgba(98, 151, 241, 0.94); font-size: 0.9rem;">${escapeHtml(trimmedLine.substring(1).trim())}</b><br/>`;
                            }
                            if (trimmedLine.startsWith('//')) {
                                const content = escapeHtml(line);
                                return `<code style="font-family: 'Courier New', monospace; background-color: rgba(6, 182, 212, 0.1); padding: 2px 4px; border-radius: 3px; font-size: 0.8rem; word-break: break-all;">${content}</code><br/>`;
                            }
                            const content = escapeHtml(line);
                            return `<span style="line-height: 1.4;">${content}</span><br/>`;
                        }).join('');
                    }
                });
                return html;
            };

            const studentGrades = students.map(student => {
                const studentId = student.id;
                const isAbsent = grades.some(g => g.student_id === studentId && g.is_absent);
                const scores = criteria.map(criterion => {
                    const grade = grades.find(g => g.student_id === studentId && g.criterion_id === criterion.id);
                    let scoreValue;
                    if (isAbsent) {
                        scoreValue = '-';
                    } else if (!grade || grade.score === null || grade.score === undefined || grade.score === '') {
                        scoreValue = 0;
                    } else {
                        scoreValue = Number(grade.score);
                    }

                    return {
                        criterionId: criterion.id,
                        label: criterion.label,
                        score: scoreValue,
                        maxScore: criterion.max_score,
                        comment: grade ? grade.comment : ''
                    };
                });
                const totalScore = scores.reduce((sum, s) => sum + (s.score !== '-' && s.score !== null ? Number(s.score) : 0), 0);
                const totalMaxScore = criteria.reduce((sum, c) => sum + parseFloat(c.max_score), 0);
                return {
                    ...student,
                    scores,
                    totalScore: isAbsent ? '-' : totalScore,
                    totalMaxScore,
                    isAbsent
                };
            });

            // Initialiser le PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            let isFirstOverallPage = true;

            // Constants pour les calculs de hauteur (ajustées pour plus de précision)
            const CONTAINER_HEIGHT = 1123;
            const CONTAINER_PADDING = 120;
            const FOOTER_HEIGHT = 80;
            const TABLE_HEADER_HEIGHT = 60;
            const BASE_ROW_HEIGHT = 60;
            const MARGIN_SAFETY = 20; // Augmenté pour plus de sécurité

            // Fonction pour créer l'en-tête
            const createHeader = (isFirstPageOfStudent = true) => `
            <div style="
                background: linear-gradient(135deg, rgba(98, 151, 241, 0.94) 0%, rgba(6, 182, 212, 1) 100%);
                margin: -60px -60px 20px -60px;
                padding: ${isFirstPageOfStudent ? '25px' : '15px'} 60px 20px 60px;
                color: white;
                position: relative;
                overflow: hidden;
            ">
                <div style="position: relative; z-index: 2;">
                    <h1 style="font-size: ${isFirstPageOfStudent ? '24px' : '20px'}; margin: 0 0 6px 0; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        Grille de cotation
                    </h1>
                    <h2 style="font-size: ${isFirstPageOfStudent ? '18px' : '16px'}; margin: 0 0 12px 0; font-weight: 400; opacity: 0.95;">
                        ${escapeHtml(evaluationName)}
                    </h2>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; opacity: 0.9;">
                        <span>Classe: <strong>${escapeHtml(evaluationData.class_name)}</strong></span>
                        <span>Date: <strong>${new Date(evaluationData.evaluation_date).toLocaleDateString('fr-FR')}</strong></span>
                    </div>
                </div>
                ${isFirstPageOfStudent ? `<div style="
                    position: absolute;
                    top: -50%;
                    right: -10%;
                    width: 150px;
                    height: 150px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    z-index: 1;
                "></div>` : ''}
            </div>
        `;

            // Fonction pour créer les infos étudiant
            const createStudentInfo = (student) => `
            <div style="
                background: ${student.isAbsent ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)'};
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 20px;
                color: white;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="font-size: 20px; margin: 0 0 6px 0; font-weight: 600;">
                            ${escapeHtml(student.firstname)} ${escapeHtml(student.lastname)}
                        </h2>
                        ${student.isAbsent ? '<span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">ABSENT</span>' : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 13px; opacity: 0.8; margin-bottom: 3px;">Total</div>
                        <div style="font-size: 24px; font-weight: 700; line-height: 1;">
                            ${student.isAbsent ? '-' : student.totalScore.toFixed(1)} <span style="font-size: 16px; font-weight: 400;">/ ${student.totalMaxScore}</span>
                        </div>
                        ${!student.isAbsent ? `<div style="font-size: 12px; opacity: 0.8;">${((student.totalScore / student.totalMaxScore) * 100).toFixed(1)}%</div>` : ''}
                    </div>
                </div>
            </div>
        `;

            // Fonction pour créer le tableau
            const createTable = (student, criteriaSlice, showHeader = true) => {
                const headerRow = showHeader ? `
                <thead>
                    <tr style="background: linear-gradient(135deg, rgba(98, 151, 241, 0.94) 0%, rgba(6, 182, 212, 1) 100%); color: white;">
                        <th style="padding: 18px; text-align: left; font-weight: 600; width: 35%;">Critère</th>
                        <th style="padding: 18px; text-align: center; font-weight: 600; width: 15%;">Note</th>
                        <th style="padding: 18px; text-align: left; font-weight: 600; width: 50%;">Commentaire</th>
                    </tr>
                </thead>
            ` : '';

                return `
                <div style="overflow: hidden; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); margin-bottom: 20px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;">
                        ${headerRow}
                        <tbody>
                            ${criteriaSlice.map((score, scoreIndex) => {
                    const isEven = scoreIndex % 2 === 0;
                    const percentage = score.score !== '-' ? (Number(score.score) / Number(score.maxScore)) * 100 : 0;
                    let scoreColor = '#64748b';
                    if (score.score !== '-') {
                        if (percentage >= 80) scoreColor = '#10b981';
                        else if (percentage >= 60) scoreColor = '#f59e0b';
                        else scoreColor = '#ef4444';
                    }

                    return `
                                    <tr style="background-color: ${isEven ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 18px; border-right: 1px solid #e2e8f0; font-weight: 500; color: #334155; vertical-align: top; width: 35%; word-wrap: break-word;">
                                            ${escapeHtml(score.label)}
                                        </td>
                                        <td style="padding: 18px; text-align: center; border-right: 1px solid #e2e8f0; vertical-align: top; width: 15%;">
                                            <div style="display: inline-flex; align-items: center; background: ${score.score === '-' ? '#f1f5f9' : 'rgba(98, 151, 241, 0.1)'}; padding: 8px 15px; border-radius: 20px; font-weight: 600; color: ${scoreColor};">
                                                ${score.score !== null && score.score !== '' ? score.score : '0'} / ${score.maxScore}
                                            </div>
                                        </td>
                                        <td style="padding: 18px; line-height: 1.4; color: #475569; vertical-align: top; width: 50%;">
                                            <div style="word-wrap: break-word; hyphens: auto; overflow-wrap: break-word;">
                                                ${score.comment ? formatCommentHtml(score.comment) : '<em style="color: #94a3b8;">Aucun commentaire</em>'}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            };

            // Fonction pour créer le pied de page
            const createFooter = (pageNum, totalPages, studentName) => `
            <div style="
                position: absolute;
                bottom: 20px;
                left: 60px;
                right: 60px;
                text-align: center;
                font-size: 11px;
                color: #64748b;
                border-top: 1px solid #e2e8f0;
                padding-top: 12px;
            ">
                ${escapeHtml(studentName)} - Page ${pageNum} / ${totalPages} - Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
            </div>
        `;

            // Fonction améliorée pour calculer la hauteur d'une ligne
            const calculateCriteriaHeight = (criterion) => {
                const CHARS_PER_LINE = 50;
                const MIN_HEIGHT = 60;
                const PADDING = 36;
                const LINE_HEIGHT = 18;

                let totalLines = 1; // Au moins 1 ligne pour le label
                if (criterion.comment) {
                    // Calculer approximativement le nombre de lignes nécessaires
                    const commentLength = criterion.comment.length;
                    const estimatedLines = Math.ceil(commentLength / CHARS_PER_LINE);
                    totalLines = Math.max(totalLines, estimatedLines);
                }

                return Math.max(MIN_HEIGHT, totalLines * LINE_HEIGHT + PADDING);
            };

            // Fonction pour échapper les caractères HTML (définie globalement)
            const escapeHtml = (unsafe) => {
                if (typeof unsafe !== 'string') return '';
                return unsafe.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };

            // Traiter chaque étudiant
            for (let studentIndex = 0; studentIndex < studentGrades.length; studentIndex++) {
                const student = studentGrades[studentIndex];

                // Calculer le nombre de pages nécessaires pour cet étudiant
                let currentCriteriaIndex = 0;
                let totalPagesForStudent = 0;
                let isFirstPageOfStudent = true;

                // Première passe : calculer le nombre total de pages
                while (currentCriteriaIndex < student.scores.length) {
                    const headerHeight = isFirstPageOfStudent ? 150 : 100;
                    const studentInfoHeight = isFirstPageOfStudent ? 100 : 0;
                    const availableHeight = CONTAINER_HEIGHT - CONTAINER_PADDING - headerHeight -
                        studentInfoHeight - FOOTER_HEIGHT - MARGIN_SAFETY - TABLE_HEADER_HEIGHT;

                    let usedHeight = 0;
                    let criteriaCount = 0;

                    while (currentCriteriaIndex < student.scores.length) {
                        const nextCriterion = student.scores[currentCriteriaIndex];
                        const nextHeight = calculateCriteriaHeight(nextCriterion);

                        if (usedHeight + nextHeight <= availableHeight) {
                            usedHeight += nextHeight;
                            currentCriteriaIndex++;
                            criteriaCount++;
                        } else {
                            break;
                        }
                    }

                    totalPagesForStudent++;
                    isFirstPageOfStudent = false;
                }
                // Deuxième passe : générer les pages
                currentCriteriaIndex = 0;
                isFirstPageOfStudent = true;

                for (let pageIndex = 0; pageIndex < totalPagesForStudent; pageIndex++) {
                    if (!isFirstOverallPage) {
                        pdf.addPage();
                    }
                    isFirstOverallPage = false;

                    const headerHeight = isFirstPageOfStudent ? 150 : 100;
                    const studentInfoHeight = isFirstPageOfStudent ? 100 : 0;
                    const availableHeight = CONTAINER_HEIGHT - CONTAINER_PADDING - headerHeight -
                        studentInfoHeight - FOOTER_HEIGHT - MARGIN_SAFETY - TABLE_HEADER_HEIGHT;

                    // Déterminer les critères pour cette page
                    const criteriaForThisPage = [];
                    let usedHeight = 0;

                    while (currentCriteriaIndex < student.scores.length) {
                        const nextCriterion = student.scores[currentCriteriaIndex];
                        const nextHeight = calculateCriteriaHeight(nextCriterion);

                        if (usedHeight + nextHeight <= availableHeight) {
                            usedHeight += nextHeight;
                            criteriaForThisPage.push(nextCriterion);
                            currentCriteriaIndex++;
                        } else {
                            break;
                        }
                    }
                    // Créer le conteneur pour cette page
                    const pdfContainer = document.createElement('div');
                    pdfContainer.style.cssText = `
                    width: 794px;
                    height: ${CONTAINER_HEIGHT}px;
                    padding: 60px;
                    box-sizing: border-box;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #1a1a1a;
                    font-size: 12px;
                    background-color: #ffffff;
                    position: absolute;
                    left: -9999px;
                    top: 0;
                `;

                    let content = createHeader(isFirstPageOfStudent);
                    if (isFirstPageOfStudent) {
                        content += createStudentInfo(student);
                    }
                    content += createTable(student, criteriaForThisPage, true);
                    content += createFooter(pageIndex + 1, totalPagesForStudent, `${student.firstname} ${student.lastname}`);

                    pdfContainer.innerHTML = content;
                    document.body.appendChild(pdfContainer);

                    try {
                        const canvas = await html2canvas(pdfContainer, {
                            scale: 2,
                            useCORS: true,
                            allowTaint: false,
                            backgroundColor: '#ffffff',
                            width: 794,
                            height: 1123,
                            scrollX: 0,
                            scrollY: 0,
                            windowWidth: 794,
                            windowHeight: 1123,
                            ignoreElements: (element) => {
                                return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
                            }
                        });

                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);

                    } catch (canvasError) {
                        console.error('Erreur lors de la capture canvas:', canvasError);
                        throw canvasError;
                    } finally {
                        document.body.removeChild(pdfContainer);
                    }

                    isFirstPageOfStudent = false;
                }
            }
            // Sauvegarder le PDF
            const fileName = `Evaluation-${evaluationName.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_')}.pdf`;
            pdf.save(fileName);

            // MODIFICATION 3a : Supprimer la notification de chargement
            removeToast(loadingToastId);
            // MODIFICATION 3b : Remplacer par le succès
            success('PDF exporté avec succès !');

        } catch (err) {
            console.error('Erreur lors de l\'exportation du PDF:', err);
            // MODIFICATION 4a : Supprimer la notification de chargement
            removeToast(loadingToastId);
            // MODIFICATION 4b : Remplacer par l'erreur
            showError('Erreur lors de l\'exportation du PDF.');
        }
    };

    if (loadingJournal) return <div className="loading-fullscreen">Chargement du journal...</div>;
    if (!currentJournal) return <div className="empty-state"><h3>Aucun journal sélectionné</h3><p>Veuillez sélectionner un journal pour continuer.</p></div>;
    if (loadingEvaluations) return <div className="loading-fullscreen">Chargement des évaluations...</div>;
    if (error) return <div className="error-message">{error}</div>;

    const isArchivedYear = currentJournal?.is_archived ?? false;

    return (
        <div className="correction-list-view">
            <div className="correction-header">
                <div className="header-title">
                    <h1>Évaluations ({currentJournal.name})</h1>
                    <p>Gérez et accédez aux corrections de vos évaluations.</p>
                </div>
                <div className="header-actions">
                    {!isArchivedYear && (
                        <button className="btn-primary" onClick={handleOpenCreateModal}>
                            + Créer une évaluation
                        </button>
                    )}
                </div>
            </div>

            {isArchivedYear ? (
                <div className="archive-warning">
                    Vous consultez un journal archivé. Les modifications sont désactivées.
                </div>
            ) : null}

            {Object.keys(groupedEvaluations).length > 0 ? (
                <div className="evaluations-container">
                    {Object.entries(groupedEvaluations).map(([className, classFolders]) => (
                        <div key={className} className="class-group">
                            <h2>Classe : {className}</h2>
                            {Object.entries(classFolders).map(([folderName, folderEvaluations]) => (
                                <div key={folderName} className="folder-group">
                                    <h3><i className="fa-regular fa-folder"></i> {folderName}</h3>
                                    <div className="evaluations-grid">
                                        {folderEvaluations.map(ev => (
                                            <div key={ev.id} className="evaluation-card">
                                                <div className="card-header">
                                                    <h2>{ev.name}</h2>
                                                    <div className="card-actions">
                                                        {!isArchivedYear && <button onClick={() => handleOpenEditModal(ev)} className="btn-edit" title="Modifier">✏️</button>}
                                                        <button onClick={() => handleOpenCopyModal(ev)} className="btn-copy" title="Copier">📄</button>
                                                        <button onClick={() => handleExportPDF(ev.id, ev.name)} className="btn-export" title="Exporter en PDF">
                                                            <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="512.000000pt" height="512.000000pt" viewBox="0 0 512.000000 512.000000" preserveAspectRatio="xMidYMid meet">
                                                                <g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)" fill="#F5383F" stroke="none">
                                                                    <path d="M518 4926 c-87 -24 -156 -85 -197 -176 -20 -45 -21 -57 -21 -2191 0 -2396 -6 -2195 72 -2284 22 -25 64 -58 92 -73 l51 -27 1600 0 1600 0 51 27 c60 32 118 93 148 157 l21 46 0 1325 c0 1097 -2 1334 -14 1380 -16 62 -52 140 -88 187 -31 40 -114 97 -183 125 -53 22 -68 23 -520 28 l-465 5 -55 26 c-70 33 -123 79 -156 135 -56 96 -57 106 -64 564 -6 410 -7 427 -29 488 -55 151 -173 239 -355 262 -114 15 -1431 11 -1488 -4z m955 -2402 c65 -11 138 -63 166 -117 34 -67 35 -182 2 -250 -49 -101 -128 -137 -298 -137 l-113 0 0 -150 0 -150 -130 0 -130 0 0 405 0 405 233 0 c127 0 249 -3 270 -6z m796 -4 c29 -5 69 -18 89 -27 59 -28 126 -102 153 -169 21 -52 23 -75 24 -204 0 -144 0 -146 -33 -212 -38 -78 -101 -138 -170 -164 -39 -14 -91 -18 -289 -22 l-243 -4 0 406 0 406 209 0 c114 0 232 -4 260 -10z m1021 -80 l0 -90 -180 0 -180 0 0 -70 0 -70 155 0 156 0 -3 -82 -3 -83 -152 -3 -153 -3 0 -159 0 -160 -130 0 -130 0 0 405 0 405 310 0 310 0 0 -90z"/>
                                                                    <path d="M1230 2270 l0 -93 58 6 c31 2 69 10 84 17 51 24 60 97 16 136 -13 13 -40 20 -89 22 l-69 4 0 -92z"/>
                                                                    <path d="M2050 2119 l0 -222 70 6 c138 12 165 46 165 212 -1 138 -15 177 -77 205 -26 12 -65 20 -100 20 l-58 0 0 -221z"/>
                                                                    <path d="M2398 4830 c17 -25 46 -88 64 -140 l33 -95 5 -390 c7 -442 7 -447 86 -534 25 -27 66 -60 92 -73 46 -23 53 -23 472 -29 477 -7 502 -10 621 -84 33 -20 62 -35 64 -34 2 2 -267 265 -597 584 -881 852 -875 845 -840 795z"/>
                                                                </g>
                                                            </svg>
                                                        </button>
                                                        {!isArchivedYear && <button onClick={() => handleDeleteClick(ev)} className="btn-delete" title="Supprimer">🗑️</button>}
                                                    </div>
                                                </div>
                                                <Link to={`/correction/${ev.id}`} className="card-link-area">
                                                    <div className="card-body">
                                                        <p><strong>Classe:</strong> {ev.class_name}</p>
                                                        <p><strong>Dossier:</strong> {ev.folder || 'Sans dossier'}</p>
                                                        <span className="card-date">{new Date(ev.evaluation_date).toLocaleDateString('fr-FR')}</span>
                                                    </div>
                                                    <div className="card-footer">
                                                        <span>{isArchivedYear ? 'Visualiser' : 'Corriger'}</span>
                                                    </div>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <h3>Aucune évaluation pour le journal : {currentJournal.name}</h3>
                    <p>Créez votre première évaluation pour commencer.</p>
                </div>
            )}

            <EvaluationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEvaluation}
                evaluation={editingEvaluation}
                evaluationToCopy={evaluationToCopy}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onClose={() => setConfirmModal({ isOpen: false })}
                onConfirm={confirmModal.onConfirm}
            />
        </div>
    );
};

export default CorrectionList;
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Utilitaires de formatage ---
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe || '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const formatCommentHtml = (text) => {
    if (!text) return '';
    const parts = text.split(/(\/\*[\s\S]*?\*\/)/g).filter(Boolean);
    let html = '';
    parts.forEach((part) => {
        if (part.startsWith('/*') && part.endsWith('*/')) {
            html += `<code style="font-family: 'Courier New', monospace; background-color: rgba(6, 182, 212, 0.1); padding: 2px 4px; border-radius: 3px; font-size: 0.8rem; word-break: break-all;">${escapeHtml(part.substring(2, part.length - 2))}</code><br/>`;
        } else {
            html += part.split('\n').map((line) => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('#')) return `<b style="color: rgba(98, 151, 241, 0.94); font-size: 0.9rem;">${escapeHtml(trimmedLine.substring(1).trim())}</b><br/>`;
                if (trimmedLine.startsWith('//')) return `<code style="font-family: 'Courier New', monospace; background-color: rgba(6, 182, 212, 0.1); padding: 2px 4px; border-radius: 3px; font-size: 0.8rem; word-break: break-all;">${escapeHtml(line)}</code><br/>`;
                return `<span style="line-height: 1.4;">${escapeHtml(line)}</span><br/>`;
            }).join('');
        }
    });
    return html;
};

// --- Templates HTML ---
const createHeader = (title, className, date, isFirstPage) => `
    <div style="background: linear-gradient(135deg, rgba(98, 151, 241, 0.94) 0%, rgba(6, 182, 212, 1) 100%); margin: -60px -60px 20px -60px; padding: ${isFirstPage ? '25px' : '15px'} 60px 20px 60px; color: white; position: relative;">
        <h1 style="font-size: ${isFirstPage ? '24px' : '20px'}; margin: 0 0 4px 0;">Grille de cotation</h1>
        <h2 style="font-size: ${isFirstPage ? '16px' : '14px'}; margin: 0 0 10px 0; font-weight: 400; opacity: 0.9;">${escapeHtml(title)}</h2>
        <div style="display: flex; justify-content: space-between; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
            <span>Classe: <strong>${escapeHtml(className)}</strong></span>
            <span>Date: <strong>${new Date(date).toLocaleDateString('fr-FR')}</strong></span>
        </div>
    </div>`;

const createStudentInfo = (student) => `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%); padding: 15px 20px; border-radius: 8px; margin-bottom: 15px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="font-size: 18px; margin: 0;">${escapeHtml(student.lastname)} ${escapeHtml(student.firstname)}</h2>
                ${student.isAbsent ? '<p style="margin: 4px 0 0 0; font-weight: bold; font-size: 12px; color: #ef4444">ÉLÈVE ABSENT</p>' : ''}
            </div>
            <div style="text-align: right;">
                <div style="font-size: 22px; font-weight: 700;">${student.isAbsent ? '-' : Number(student.totalScore).toFixed(1)} / ${student.totalMaxScore}</div>
            </div>
        </div>
        ${student.globalComment && !student.isAbsent ? `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.15); font-size: 11px; font-style: italic;">
                <strong>Bilan général :</strong><br/>
                <div style="margin-top: 4px;">${formatCommentHtml(student.globalComment)}</div>
            </div>
        ` : ''}
    </div>`;

// --- Logique de calcul de hauteur ---
const calculateCriteriaHeight = (criterion) => {
    const CHARS_PER_LINE = 60;
    const commentLines = criterion.comment ? Math.ceil(criterion.comment.length / CHARS_PER_LINE) : 0;
    // Base 40px + lignes de commentaires
    return 45 + (commentLines * 16);
};

// --- Exportation principale ---
export const generateEvaluationPDF = async (evaluation, students, criteria, grades) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const CONTAINER_HEIGHT = 1123;
    const FOOTER_HEIGHT = 60;
    let isFirstOverallPage = true;

    // 1. Préparation des données calquée sur CorrectionView
    const studentGrades = students.map(student => {
        // Vérifier si l'élève est absent (via la clé globale ou les données globales transmises)
        const isAbsent = grades[`global-${student.id}`]?.is_absent || false;
        const globalComment = grades[`global-${student.id}`]?.comment || '';

        const scores = criteria.map(c => {
            const g = grades[`${student.id}-${c.id}`];
            return {
                label: c.name || c.label,
                section: c.section_name || 'Général',
                maxPoints: c.max_points,
                score: isAbsent ? '-' : (g?.score ?? 0),
                comment: isAbsent ? '' : (g?.comment || '')
            };
        });

        // Calcul du total
        const totalScore = isAbsent ? 0 : scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);

        return {
            ...student,
            scores,
            isAbsent,
            globalComment,
            totalScore,
            totalMaxScore: evaluation.max_score
        };
    });

    // 2. Génération par élève
    for (const student of studentGrades) {
        let currentCriteriaIndex = 0;
        let pageNum = 1;

        while (currentCriteriaIndex < student.scores.length) {
            if (!isFirstOverallPage) pdf.addPage();
            isFirstOverallPage = false;

            const isFirstPageOfStudent = pageNum === 1;
            const pdfContainer = document.createElement('div');
            pdfContainer.style.cssText = `width: 794px; min-height: 1123px; padding: 60px; box-sizing: border-box; background: white; position: absolute; left: -9999px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;`;

            // Calcul de l'espace disponible (en pixels)
            const headerEstimate = isFirstPageOfStudent ? 350 : 180;
            const availableHeight = CONTAINER_HEIGHT - headerEstimate - FOOTER_HEIGHT;

            const criteriaForThisPage = [];
            let usedHeight = 0;

            while (currentCriteriaIndex < student.scores.length) {
                const crit = student.scores[currentCriteriaIndex];
                const h = calculateCriteriaHeight(crit);

                if (usedHeight + h > availableHeight && criteriaForThisPage.length > 0) break;

                usedHeight += h;
                criteriaForThisPage.push(crit);
                currentCriteriaIndex++;
            }

            // Construction du HTML
            let html = createHeader(evaluation.title, evaluation.class_name, evaluation.evaluation_date, isFirstPageOfStudent);
            if (isFirstPageOfStudent) html += createStudentInfo(student);

            html += `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 12px; color: #64748b;">
                            <th style="padding: 10px;">Critère</th>
                            <th style="padding: 10px; width: 80px;">Note</th>
                            <th style="padding: 10px;">Commentaires</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${criteriaForThisPage.map(s => `
                            <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                                <td style="padding: 12px 10px; vertical-align: top;">
                                    <div style="color: #475569; font-size: 10px; text-transform: uppercase; margin-bottom: 2px; opacity: 0.7;">${escapeHtml(s.section)}</div>
                                    <div style="font-weight: 600; color: #1e293b;">${escapeHtml(s.label)}</div>
                                </td>
                                <td style="padding: 12px 10px; vertical-align: top; white-space: nowrap; font-weight: bold;">
                                    ${s.score} / ${s.maxPoints}
                                </td>
                                <td style="padding: 12px 10px; vertical-align: top; color: #334155;">
                                    ${s.comment ? formatCommentHtml(s.comment) : '<span style="color: #cbd5e1;">-</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="position: absolute; bottom: 40px; right: 60px; font-size: 10px; color: #94a3b8;">
                    Page ${pageNum} - ${student.firstname} ${student.lastname}
                </div>
            `;

            pdfContainer.innerHTML = html;
            document.body.appendChild(pdfContainer);

            const canvas = await html2canvas(pdfContainer, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, 297);
            document.body.removeChild(pdfContainer);
            pageNum++;
        }
    }

    const fileName = `Evaluation_${evaluation.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    pdf.save(fileName);
};
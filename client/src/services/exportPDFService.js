import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Utilitaires de formatage ---
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

const formatCommentHtml = (text) => {
    if (!text) return '';
    const parts = text.split(/(\/\*[\s\S]*?\*\/)/g).filter(Boolean);
    let html = '';
    parts.forEach((part) => {
        if (part.startsWith('/*') && part.endsWith('*/')) {
            html += `<code style="font-family: 'Courier New', monospace; background-color: rgba(6, 182, 212, 0.1); padding: 2px 4px; border-radius: 3px; font-size: 0.8rem; word-break: break-all;">${escapeHtml(part)}</code><br/>`;
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
        <h1 style="font-size: ${isFirstPage ? '24px' : '20px'}; margin: 0 0 6px 0;">Grille de cotation</h1>
        <h2 style="font-size: ${isFirstPage ? '18px' : '16px'}; margin: 0 0 12px 0; font-weight: 400;">${escapeHtml(title)}</h2>
        <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span>Classe: <strong>${escapeHtml(className)}</strong></span>
            <span>Date: <strong>${new Date(date).toLocaleDateString('fr-FR')}</strong></span>
        </div>
    </div>`;

const createStudentInfo = (student) => `
    <div style="background: ${student.isAbsent ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)'}; padding: 20px; border-radius: 10px; margin-bottom: 20px; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: 20px; margin: 0;">${escapeHtml(student.firstname)} ${escapeHtml(student.lastname)} ${student.isAbsent ? '(ABSENT)' : ''}</h2>
            <div style="text-align: right;">
                <div style="font-size: 24px; font-weight: 700;">${student.isAbsent ? '-' : student.totalScore.toFixed(1)} / ${student.totalMaxScore}</div>
            </div>
        </div>
    </div>`;

// --- Logique de calcul de hauteur ---
const calculateCriteriaHeight = (criterion) => {
    const CHARS_PER_LINE = 50;
    const commentLines = criterion.comment ? Math.ceil(criterion.comment.length / CHARS_PER_LINE) : 1;
    return Math.max(60, commentLines * 18 + 36);
};

// --- Exportation principale ---
export const generateEvaluationPDF = async (evaluationData, students, criteria, grades) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const CONTAINER_HEIGHT = 1123;
    const FOOTER_HEIGHT = 80;
    let isFirstOverallPage = true;

    // Préparation des données (étudiants + notes)
    const studentGrades = students.map(student => {
        const isAbsent = grades.some(g => g.student_id === student.id && g.is_absent);
        const scores = criteria.map(c => {
            const g = grades.find(grade => grade.student_id === student.id && grade.criterion_id === c.id);
            return {
                label: c.label,
                maxScore: c.max_score,
                score: isAbsent ? '-' : (g?.score ?? 0),
                comment: g?.comment || ''
            };
        });
        return {
            ...student,
            scores,
            isAbsent,
            totalScore: isAbsent ? '-' : scores.reduce((sum, s) => sum + Number(s.score), 0),
            totalMaxScore: criteria.reduce((sum, c) => sum + Number(c.max_score), 0)
        };
    });

    for (const student of studentGrades) {
        let currentCriteriaIndex = 0;
        let pageNum = 1;

        while (currentCriteriaIndex < student.scores.length) {
            if (!isFirstOverallPage) pdf.addPage();
            isFirstOverallPage = false;

            const isFirstPageOfStudent = pageNum === 1;
            const pdfContainer = document.createElement('div');
            pdfContainer.style.cssText = `width: 794px; height: 1123px; padding: 60px; box-sizing: border-box; background: white; position: absolute; left: -9999px; font-family: sans-serif;`;

            // Calcul de l'espace disponible
            const headerHeight = isFirstPageOfStudent ? 250 : 150;
            const availableHeight = CONTAINER_HEIGHT - headerHeight - FOOTER_HEIGHT - 40;

            const criteriaForThisPage = [];
            let usedHeight = 0;
            while (currentCriteriaIndex < student.scores.length) {
                const h = calculateCriteriaHeight(student.scores[currentCriteriaIndex]);
                if (usedHeight + h > availableHeight) break;
                usedHeight += h;
                criteriaForThisPage.push(student.scores[currentCriteriaIndex++]);
            }

            // Construction du HTML
            let html = createHeader(evaluationData.name, evaluationData.class_name, evaluationData.evaluation_date, isFirstPageOfStudent);
            if (isFirstPageOfStudent) html += createStudentInfo(student);

            // Table simplification pour l'exemple (garder votre logique de table ici)
            html += `<table style="width: 100%; border-collapse: collapse;">
                ${criteriaForThisPage.map(s => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 15px; width: 35%">${escapeHtml(s.label)}</td>
                        <td style="padding: 15px; width: 15%">${s.score} / ${s.maxScore}</td>
                        <td style="padding: 15px; width: 50%">${formatCommentHtml(s.comment)}</td>
                    </tr>`).join('')}
            </table>`;

            pdfContainer.innerHTML = html;
            document.body.appendChild(pdfContainer);

            const canvas = await html2canvas(pdfContainer, { scale: 2 });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
            document.body.removeChild(pdfContainer);
            pageNum++;
        }
    }

    const fileName = `Evaluation-${evaluationData.name.replace(/\s+/g, '_')}.pdf`;
    pdf.save(fileName);
};
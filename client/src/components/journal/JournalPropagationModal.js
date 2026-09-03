import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, ArrowRight, CheckCircle2, CopyCheck, Loader2, X
} from 'lucide-react';
import JournalService from '../../services/JournalService';
import { useToast } from '../../hooks/useToast';
import './JournalPropagationModal.scss';

const NONE = '__none';

const formatPeriod = (period) => {
    if (!period) return null;
    const show = (key) => key.split('-').reverse().join('/');
    return `${show(period.start)} → ${show(period.end)}`;
};

/**
 * « Propager » : rejouer une année de cours sur un autre journal.
 *
 * Le travail effectué l'an dernier devient le travail prévu de l'année à venir,
 * leçon par leçon et dans l'ordre — la 35e leçon d'informatique de 3ème se pose
 * sur le 35e créneau d'informatique de 3ème du nouveau journal. Les congés et
 * l'horaire diffèrent d'une année à l'autre : c'est le rang qui fait le lien,
 * jamais la date.
 */
const JournalPropagationModal = ({ source, journals, onClose, onDone }) => {
    const { success, error: showError } = useToast();

    const candidates = useMemo(
        () => journals.filter(j => j.id !== source.id),
        [journals, source.id]
    );

    const [targetId, setTargetId] = useState(() => candidates[0]?.id ?? '');
    const [preview, setPreview] = useState(null);
    const [choices, setChoices] = useState({});      // key du cours -> id de classe cible
    const [overwrite, setOverwrite] = useState(false);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [report, setReport] = useState(null);

    const loadPreview = useCallback(async () => {
        if (!targetId) { setPreview(null); return; }
        setLoading(true);
        setReport(null);
        try {
            const res = await JournalService.previewPropagation(source.id, targetId);
            const data = res.data;
            setPreview(data);
            setChoices(Object.fromEntries(
                data.courses.map(c => [c.key, c.suggested_class_id ? String(c.suggested_class_id) : NONE])
            ));
        } catch (err) {
            setPreview(null);
            showError(err.response?.data?.message || err.message || 'Lecture impossible.');
        } finally {
            setLoading(false);
        }
    }, [source.id, targetId, showError]);

    useEffect(() => { loadPreview(); }, [loadPreview]);

    // Ce qui sera réellement écrit, et ce qui n'entrera pas faute de créneaux.
    const plan = useMemo(() => {
        if (!preview) return { pairs: [], lessons: 0, leftover: 0 };
        const pairs = [];
        let lessons = 0;
        let leftover = 0;

        for (const course of preview.courses) {
            const chosen = choices[course.key];
            if (!chosen || chosen === NONE) continue;
            const slots = course.occurrences_by_class[chosen] || 0;
            pairs.push({
                source_class_id: course.source_class_id,
                subject_id: course.subject_id,
                target_class_id: Number(chosen)
            });
            lessons += Math.min(course.lessons, slots);
            leftover += Math.max(0, course.lessons - slots);
        }
        return { pairs, lessons, leftover };
    }, [preview, choices]);

    const handleApply = async () => {
        if (plan.pairs.length === 0) {
            showError('Aucun cours à propager : associez au moins une classe.');
            return;
        }
        setBusy(true);
        try {
            const res = await JournalService.applyPropagation({
                source_journal_id: source.id,
                target_journal_id: Number(targetId),
                overwrite,
                pairs: plan.pairs
            });
            setReport(res.data);
            success(res.message || 'Propagation terminée.');
            onDone?.();
        } catch (err) {
            showError(err.response?.data?.message || err.message || 'Échec de la propagation.');
        } finally {
            setBusy(false);
        }
    };

    const targetName = preview?.target?.name
        || candidates.find(j => String(j.id) === String(targetId))?.name
        || '';

    // Pas de classe `modal-overlay` : la feuille ci-jointe se suffit, et la règle
    // globale du même nom (JournalManager.scss) imposerait son z-index selon
    // l'ordre des imports.
    return (
        <div className="journal-propagation-modal">
            <div className="propagation-panel">
                <div className="panel-header">
                    <div className="title">
                        <CopyCheck size={22} className="accent-icon" />
                        <h3>Propager « {source.name} »</h3>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
                </div>

                <div className="panel-body">
                    <p className="lead">
                        Le travail effectué dans ce journal devient le <strong>travail prévu</strong> du journal
                        choisi, leçon après leçon : la 35<sup>e</sup> leçon d’un cours se pose sur le
                        35<sup>e</sup> créneau du même cours l’année suivante. Les cours annulés et les créneaux
                        vides ne comptent pas — la suite est recompactée. Le travail déjà effectué dans le
                        journal cible n’est jamais modifié.
                    </p>

                    <div className="form-row">
                        <div className="form-group grow">
                            <label>Journal à remplir</label>
                            <select
                                className="glass-input"
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                disabled={busy}
                            >
                                {candidates.length === 0 && <option value="">Aucun autre journal</option>}
                                {candidates.map(j => (
                                    <option key={j.id} value={j.id}>{j.name}</option>
                                ))}
                            </select>
                        </div>
                        {preview?.target?.period && (
                            <p className="hint">
                                Année couverte : {formatPeriod(preview.target.period)}
                            </p>
                        )}
                    </div>

                    {loading && (
                        <div className="notice"><Loader2 size={15} className="animate-spin" /><span>Lecture des deux journaux…</span></div>
                    )}

                    {!loading && preview && preview.target.schedule_count === 0 && (
                        <div className="notice warn">
                            <AlertTriangle size={15} />
                            <span>
                                <strong>{targetName}</strong> n’a aucun horaire : sans grille, il n’y a pas de
                                créneaux où poser les leçons. Créez ou importez d’abord son emploi du temps.
                            </span>
                        </div>
                    )}

                    {!loading && preview && preview.courses.length === 0 && (
                        <div className="notice warn">
                            <AlertTriangle size={15} />
                            <span>Aucune leçon exploitable dans « {source.name} ».</span>
                        </div>
                    )}

                    {!loading && preview?.orphan_entries > 0 && (
                        <div className="notice">
                            <AlertTriangle size={15} />
                            <span>
                                {preview.orphan_entries} entrée(s) sur un créneau sans classe ou sans matière :
                                impossible de savoir de quel cours il s’agit, elles sont ignorées.
                            </span>
                        </div>
                    )}

                    {!loading && preview && preview.courses.length > 0 && (
                        <section>
                            <h4>Cours à rejouer</h4>
                            {preview.courses.map(course => {
                                const chosen = choices[course.key] ?? NONE;
                                const slots = chosen === NONE ? 0 : (course.occurrences_by_class[chosen] || 0);
                                const short = chosen !== NONE && slots < course.lessons;
                                return (
                                    <div className="course-row" key={course.key}>
                                        <div className="course-source">
                                            <strong>{course.source_class_name}</strong>
                                            <span className="subject">{course.subject_name}</span>
                                            <span className="chip">
                                                {course.lessons} leçon{course.lessons > 1 ? 's' : ''}
                                                {course.ignored > 0 && ` · ${course.ignored} ignorée${course.ignored > 1 ? 's' : ''}`}
                                            </span>
                                        </div>

                                        <ArrowRight size={16} className="arrow" />

                                        <div className="course-target">
                                            <select
                                                className="glass-input"
                                                value={chosen}
                                                disabled={busy}
                                                onChange={(e) => setChoices(prev => ({ ...prev, [course.key]: e.target.value }))}
                                            >
                                                <option value={NONE}>— Ne pas propager —</option>
                                                {preview.target_classes.map(c => {
                                                    const count = course.occurrences_by_class[String(c.id)] || 0;
                                                    return (
                                                        <option key={c.id} value={String(c.id)} disabled={count === 0}>
                                                            {c.name}{count === 0 ? ' (aucun créneau)' : ` — ${count} créneaux`}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {short && (
                                                <span className="chip warn">
                                                    {course.lessons - slots} leçon(s) en trop
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                    )}

                    {!loading && preview && preview.courses.length > 0 && (
                        <label className="overwrite-toggle">
                            <input
                                type="checkbox"
                                checked={overwrite}
                                disabled={busy}
                                onChange={(e) => setOverwrite(e.target.checked)}
                            />
                            <span>
                                Remplacer le travail prévu déjà encodé dans « {targetName} ».
                                Sinon ces créneaux sont laissés tels quels — mais ils consomment quand même
                                leur leçon, pour que la suite reste calée sur le calendrier.
                            </span>
                        </label>
                    )}

                    {report && (
                        <section className="report">
                            <h4>Résultat</h4>
                            {report.courses.map((line, i) => (
                                <div className="report-row" key={i}>
                                    <strong>{line.class_name} · {line.subject_name}</strong>
                                    <span>
                                        {line.planned} créneau(x) planifié(s) sur {line.occurrences}
                                        {line.preserved > 0 && ` · ${line.preserved} conservé(s)`}
                                        {line.leftover > 0 && ` · ${line.leftover} leçon(s) sans place`}
                                    </span>
                                </div>
                            ))}
                        </section>
                    )}
                </div>

                <div className="panel-footer">
                    {!report && plan.pairs.length > 0 && (
                        <span className="footer-summary">
                            {plan.lessons} créneau(x) seront planifiés
                            {plan.leftover > 0 && ` — ${plan.leftover} leçon(s) resteront sans place`}
                        </span>
                    )}
                    <div className="spacer" />
                    <button className="glass-btn" onClick={onClose} disabled={busy}>
                        {report ? 'Fermer' : 'Annuler'}
                    </button>
                    {!report && (
                        <button
                            className="glass-btn primary"
                            onClick={handleApply}
                            disabled={busy || loading || plan.pairs.length === 0}
                        >
                            {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                            Propager
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JournalPropagationModal;

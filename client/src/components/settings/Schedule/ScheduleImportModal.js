import React, { useMemo, useRef, useState } from 'react';
import {
    AlertTriangle, ArrowLeft, CheckCircle2, Clock, FileUp,
    Loader2, Sparkles, Upload, X
} from 'lucide-react';
import ScheduleService from '../../../services/ScheduleService';
import { useToast } from '../../../hooks/useToast';
import './ScheduleImportModal.scss';

const DAY_LABELS = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 7: 'Dimanche' };
const LEVELS = ['1ère', '2ème', '3ème', '4ème', '5ème', '6ème', 'Rhétos'];

const CONFIDENCE_LABEL = {
    exact: { text: 'Correspondance exacte', tone: 'ok' },
    high: { text: 'Correspondance probable', tone: 'ok' },
    low: { text: 'À vérifier', tone: 'warn' },
    none: { text: 'Rien de similaire', tone: 'new' }
};

/**
 * Import d'un emploi du temps depuis le PDF de l'école.
 * Deux temps : on dépose le fichier, puis on valide ce que le serveur a lu
 * (correspondances matières / classes) avant la moindre écriture.
 */
const ScheduleImportModal = ({ journalId, sets, selectedSet, subjects, classes, onClose, onImported }) => {
    const { success, error: showError } = useToast();
    const fileInputRef = useRef(null);

    const [step, setStep] = useState('pick');     // pick | review
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState(null);

    const [subjectChoices, setSubjectChoices] = useState({});
    const [classChoices, setClassChoices] = useState({});

    const [mode, setMode] = useState('create');
    const [targetSet, setTargetSet] = useState('');
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- Étape 1 : lecture du PDF -----------------------------------------
    const handleFile = async (file) => {
        if (!file) return;
        if (!/\.pdf$/i.test(file.name)) {
            showError('Seuls les fichiers PDF sont acceptés.');
            return;
        }
        setBusy(true);
        setFileName(file.name);
        try {
            const res = await ScheduleService.previewPdfImport(journalId, file);
            const data = res.data;
            setPreview(data);

            setSubjectChoices(Object.fromEntries(data.subjects.map(s => [
                s.raw,
                s.id ? { action: 'link', id: s.id } : { action: 'create', name: s.raw, color_code: s.color }
            ])));
            setClassChoices(Object.fromEntries(data.classes.map(c => [
                c.raw,
                c.id ? { action: 'link', id: c.id } : { action: 'create', name: c.raw, level: c.level }
            ])));

            const hasSets = (sets || []).length > 0;
            setMode(hasSets && selectedSet ? 'replace' : 'create');
            setTargetSet(selectedSet || (hasSets ? sets[0].id : ''));
            setName(data.suggestion.name);
            setStartDate(data.suggestion.start_date);
            setEndDate(data.suggestion.end_date);
            setStep('review');
        } catch (err) {
            showError(err.response?.data?.message || err.message || 'Lecture du PDF impossible');
            setFileName('');
        } finally {
            setBusy(false);
        }
    };

    // --- Étape 2 : écriture ------------------------------------------------
    const handleImport = async () => {
        if (mode === 'create' && (!name.trim() || !startDate || !endDate)) {
            showError('Nom et dates de validité requis.');
            return;
        }
        if (mode === 'create' && new Date(endDate) < new Date(startDate)) {
            showError('La date de fin ne peut pas être avant la date de début.');
            return;
        }
        setBusy(true);
        try {
            const res = await ScheduleService.applyPdfImport({
                journal_id: journalId,
                mode,
                set_id: mode === 'replace' ? targetSet : undefined,
                name: name.trim(),
                start_date: startDate,
                end_date: endDate,
                subjectMap: subjectChoices,
                classMap: classChoices,
                slots: preview.slots
            });
            const { set_id, slots, created } = res.data;
            const extras = [
                created.classes.length && `${created.classes.length} classe(s)`,
                created.subjects.length && `${created.subjects.length} matière(s)`,
                created.hours.length && `${created.hours.length} créneau(x)`
            ].filter(Boolean);
            success(`${slots} cours importés${extras.length ? ` — créé : ${extras.join(', ')}` : ''}`);
            onImported(set_id);
        } catch (err) {
            showError(err.response?.data?.message || err.message || "Échec de l'import");
        } finally {
            setBusy(false);
        }
    };

    // --- Aperçu de la grille ----------------------------------------------
    const gridPreview = useMemo(() => {
        if (!preview) return null;
        const libelles = [...new Set(preview.slots.map(s => s.libelle))].sort();
        const days = [...new Set(preview.slots.map(s => s.day))].sort((a, b) => a - b);
        const byKey = new Map(preview.slots.map(s => [`${s.day}-${s.libelle}`, s]));
        return { libelles, days, byKey };
    }, [preview]);

    const colorFor = (raw) => preview?.subjects.find(s => s.raw === raw)?.color || '#94a3b8';
    const newHours = preview?.periods.filter(p => p.used && !p.hour_id) || [];

    const setChoice = (setter, raw, value) => setter(prev => ({ ...prev, [raw]: value }));

    const renderMappingRow = (entry, choices, setter, isClass) => {
        const choice = choices[entry.raw] || {};
        const options = isClass ? classes : subjects;
        const badge = CONFIDENCE_LABEL[entry.confidence] || CONFIDENCE_LABEL.none;
        return (
            <div className="map-row" key={entry.raw}>
                <div className="map-source">
                    {!isClass && <span className="swatch" style={{ background: colorFor(entry.raw) }} />}
                    <strong>{entry.raw}</strong>
                    <span className={`chip ${badge.tone}`}>{badge.text}</span>
                </div>
                <div className="map-target">
                    <select
                        className="glass-input"
                        value={choice.action === 'link' ? String(choice.id) : choice.action === 'ignore' ? '__ignore' : '__create'}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v === '__create') {
                                setChoice(setter, entry.raw, isClass
                                    ? { action: 'create', name: entry.raw, level: entry.level }
                                    : { action: 'create', name: entry.raw, color_code: entry.color });
                            } else if (v === '__ignore') {
                                setChoice(setter, entry.raw, { action: 'ignore' });
                            } else {
                                setChoice(setter, entry.raw, { action: 'link', id: Number(v) });
                            }
                        }}
                    >
                        <option value="__create">➕ Créer « {entry.raw} »</option>
                        {options.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                        <option value="__ignore">— Ne pas associer —</option>
                    </select>
                    {choice.action === 'create' && isClass && (
                        <select
                            className="glass-input level-select"
                            value={choice.level || ''}
                            onChange={(e) => setChoice(setter, entry.raw, { ...choice, level: e.target.value })}
                        >
                            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="modal-overlay schedule-import-modal">
            <div className="import-panel">
                <div className="panel-header">
                    <div className="title">
                        <FileUp size={22} className="accent-icon" />
                        <h3>Importer un horaire PDF</h3>
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
                </div>

                {step === 'pick' && (
                    <div className="panel-body">
                        <div
                            className={`dropzone ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                if (!busy) handleFile(e.dataTransfer.files?.[0]);
                            }}
                            onClick={() => !busy && fileInputRef.current?.click()}
                        >
                            {busy ? <Loader2 size={42} className="animate-spin" /> : <Upload size={42} />}
                            <h4>{busy ? `Lecture de ${fileName}…` : 'Déposez le PDF de votre emploi du temps'}</h4>
                            <p>Le fichier « Emploi du temps … .pdf » exporté par l’école. Rien n’est enregistré avant votre validation.</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf,.pdf"
                                hidden
                                onChange={(e) => handleFile(e.target.files?.[0])}
                            />
                        </div>
                    </div>
                )}

                {step === 'review' && preview && (
                    <>
                        <div className="panel-body">
                            <div className="summary">
                                <Sparkles size={16} className="accent-icon" />
                                <span>
                                    <strong>{preview.slots.length} cours</strong> lus sur {gridPreview.days.length} jours
                                    {preview.teacher ? ` — ${preview.teacher}` : ''}
                                    {preview.school ? ` · ${preview.school}` : ''}
                                </span>
                            </div>

                            {preview.warnings.map((w, i) => (
                                <div className="notice warn" key={i}><AlertTriangle size={15} /><span>{w}</span></div>
                            ))}
                            {newHours.length > 0 && (
                                <div className="notice warn">
                                    <Clock size={15} />
                                    <span>
                                        Créneaux horaires absents de vos réglages, ils seront créés :{' '}
                                        <strong>{newHours.map(h => h.libelle).join(', ')}</strong>.
                                    </span>
                                </div>
                            )}

                            <section>
                                <h4>Grille lue dans le PDF</h4>
                                <div className="grid-scroll">
                                    <table className="preview-table">
                                        <thead>
                                        <tr>
                                            <th>Heure</th>
                                            {gridPreview.days.map(d => <th key={d}>{DAY_LABELS[d] || d}</th>)}
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {gridPreview.libelles.map(lib => (
                                            <tr key={lib}>
                                                <td className="hour">{lib}</td>
                                                {gridPreview.days.map(d => {
                                                    const slot = gridPreview.byKey.get(`${d}-${lib}`);
                                                    if (!slot) return <td key={d} className="empty" />;
                                                    return (
                                                        <td key={d} className="filled" style={{ '--slot-color': colorFor(slot.subject) }}>
                                                            <strong>{slot.subject}</strong>
                                                            <span>{slot.className}</span>
                                                            {slot.room && <small>{slot.room}</small>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section>
                                <h4>Matières</h4>
                                {preview.subjects.map(s => renderMappingRow(s, subjectChoices, setSubjectChoices, false))}
                            </section>

                            <section>
                                <h4>Classes</h4>
                                {preview.classes.map(c => renderMappingRow(c, classChoices, setClassChoices, true))}
                            </section>

                            <section>
                                <h4>Où l’enregistrer ?</h4>
                                <div className="target-choice">
                                    <label className={mode === 'replace' ? 'active' : ''}>
                                        <input
                                            type="radio"
                                            checked={mode === 'replace'}
                                            disabled={!sets.length}
                                            onChange={() => setMode('replace')}
                                        />
                                        <span>Remplacer un modèle existant</span>
                                    </label>
                                    <label className={mode === 'create' ? 'active' : ''}>
                                        <input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} />
                                        <span>Créer un nouveau modèle</span>
                                    </label>
                                </div>

                                {mode === 'replace' ? (
                                    <div className="form-row">
                                        <div className="form-group grow">
                                            <label>Modèle à écraser</label>
                                            <select className="glass-input" value={targetSet} onChange={(e) => setTargetSet(e.target.value)}>
                                                {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <p className="hint">Ses créneaux actuels seront remplacés ; ses dates de validité ne changent pas.</p>
                                    </div>
                                ) : (
                                    <div className="form-row">
                                        <div className="form-group grow">
                                            <label>Nom du modèle</label>
                                            <input className="glass-input" value={name} onChange={(e) => setName(e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>Début</label>
                                            <input type="date" className="glass-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>Fin</label>
                                            <input type="date" className="glass-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="panel-footer">
                            <button className="glass-btn" onClick={() => { setStep('pick'); setPreview(null); }} disabled={busy}>
                                <ArrowLeft size={16} /> Changer de fichier
                            </button>
                            <div className="spacer" />
                            <button className="glass-btn" onClick={onClose} disabled={busy}>Annuler</button>
                            <button className="glass-btn primary" onClick={handleImport} disabled={busy}>
                                {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                Importer
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ScheduleImportModal;

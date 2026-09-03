// Choix du modele d'horaire (SCHEDULE_SETS) qui fait foi a une date donnee.
//
// Les periodes de validite peuvent se chevaucher : importer un nouvel horaire
// ne cloture pas automatiquement le precedent. Il faut donc une regle unique,
// partagee par le journal, le tableau de bord et le serveur
// (`ScheduleController.getScheduleByDate`), faute de quoi deux ecrans affichent
// deux horaires differents pour la meme semaine.
//
// Regle : parmi les modeles valides ce jour-la, celui entre en vigueur le plus
// tard l'emporte ; a egalite de date de debut, le plus recemment cree (id le
// plus grand).

const pad = (n) => String(n).padStart(2, '0');

/**
 * Ramene une date a sa cle 'YYYY-MM-DD', comparable lexicographiquement.
 * Les dates renvoyees par l'API sont des ISO UTC ('2026-08-31T22:00:00.000Z'
 * pour le 1er septembre en Belgique) : elles doivent etre relues en heure
 * locale, sinon la journee est decalee.
 */
export const toDateKey = (value) => {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const compareSets = (a, b) => {
    const ka = toDateKey(a?.start_time) || '';
    const kb = toDateKey(b?.start_time) || '';
    if (ka !== kb) return ka < kb ? -1 : 1;
    return Number(a?.id || 0) - Number(b?.id || 0);
};

/** Les modeles du plus ancien au plus recent — meme ordre que le serveur. */
export const sortSetsByStart = (sets) => [...(sets || [])].sort(compareSets);

const covers = (set, dayKey) => {
    const start = toDateKey(set?.start_time);
    const end = toDateKey(set?.end_time);
    return !!start && !!end && dayKey >= start && dayKey <= end;
};

/** Le modele en vigueur a cette date, ou null si aucun ne la couvre. */
export const findSetForDate = (sets, date) => {
    const dayKey = toDateKey(date);
    if (!dayKey) return null;
    const eligible = sortSetsByStart(sets).filter(s => covers(s, dayKey));
    return eligible.length ? eligible[eligible.length - 1] : null;
};

/**
 * Le modele dont la validite recouvre la periode [start, end] — le plus recent
 * s'il y en a plusieurs, car c'est celui qu'un nouvel horaire vient remplacer.
 */
export const findOverlappingSet = (sets, start, end, excludeId = null) => {
    const a = toDateKey(start);
    const b = toDateKey(end);
    if (!a || !b) return null;

    const overlapping = sortSetsByStart(sets).filter(s => {
        if (excludeId != null && Number(s.id) === Number(excludeId)) return false;
        const sa = toDateKey(s.start_time);
        const sb = toDateKey(s.end_time);
        return !!sa && !!sb && a <= sb && b >= sa;
    });
    return overlapping.length ? overlapping[overlapping.length - 1] : null;
};

/** La veille de `date`, au format 'YYYY-MM-DD' : fin de validite du modele sortant. */
export const dayBefore = (date) => {
    const key = toDateKey(date);
    if (!key) return null;
    const [y, m, d] = key.split('-').map(Number);
    const previous = new Date(y, m - 1, d - 1);
    return toDateKey(previous);
};

/** Le lundi suivant `from` (le lundi prochain, jamais celui de la semaine en cours). */
export const nextMonday = (from = new Date()) => {
    const base = from instanceof Date ? new Date(from) : new Date(from);
    if (isNaN(base.getTime())) return null;
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + (((8 - base.getDay()) % 7) || 7));
    return toDateKey(base);
};

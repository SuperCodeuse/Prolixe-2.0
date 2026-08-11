// client/src/utils/attributionHours.js
//
// Les attributions d'une même année scolaire ne se chevauchent pas toutes sur
// la même période : le nombre d'heures effectivement prestées varie donc au fil
// de l'année. Plutôt qu'une somme brute (qui additionnerait des heures qui ne
// coexistent jamais), on retient la valeur tenue pendant le plus grand nombre
// de jours, accompagnée de son amplitude min–max.

const DAY_MS = 24 * 60 * 60 * 1000;

// SCHOOL_YEARS ne stocke que des années (« 2025 », en tinytext), jamais de date
// de rentrée. On applique donc la convention belge : 1er septembre → 31 août.
// Sans cette fenêtre, une attribution débordant sur l'année civile précédente
// (ex. un remplacement encodé au 1er janvier) dominerait le calcul avec ses
// mois passés hors année scolaire.
const SCHOOL_YEAR_START_MONTH = 8; // septembre (0-indexé)
const SCHOOL_YEAR_END_MONTH = 7;   // août
const SCHOOL_YEAR_END_DAY = 31;

const toUTC = (value) => {
    if (!value) return null;
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
};

// Valeur dominante = celle qui couvre le plus de jours. À durée strictement
// égale on garde la plus petite, pour que l'affichage reste stable.
const summarizeMetric = (segments, pick) => {
    const daysByValue = new Map();
    for (const segment of segments) {
        const value = pick(segment);
        daysByValue.set(value, (daysByValue.get(value) || 0) + segment.days);
    }

    const values = [...daysByValue.keys()];
    const dominant = values.reduce((best, value) => {
        const days = daysByValue.get(value);
        const bestDays = daysByValue.get(best);
        if (days > bestDays) return value;
        if (days === bestDays && value < best) return value;
        return best;
    });

    return { value: dominant, min: Math.min(...values), max: Math.max(...values) };
};

/**
 * @param {Array} attributions attributions d'une même année scolaire
 * @param {number|string} startYear année de rentrée (SCHOOL_YEARS.start_date)
 * @returns {{esi: object, ess: object, total: object}|null}
 *          chaque entrée vaut { value, min, max }
 */
export const summarizeYearHours = (attributions, startYear) => {
    const year = Number(startYear);
    if (!Number.isFinite(year) || !attributions || attributions.length === 0) return null;

    const windowStart = Date.UTC(year, SCHOOL_YEAR_START_MONTH, 1);
    const windowEnd = Date.UTC(year + 1, SCHOOL_YEAR_END_MONTH, SCHOOL_YEAR_END_DAY);

    const spans = attributions
        .map((a) => ({
            from: toUTC(a.start_date),
            to: toUTC(a.end_date),
            esi: Number(a.esi_hours) || 0,
            ess: Number(a.ess_hours) || 0
        }))
        .filter((s) => s.from !== null && s.to !== null && s.from <= s.to);

    if (spans.length === 0) return null;

    // Balayage jour par jour (365 itérations, coût négligeable). Les jours sans
    // aucune attribution active sont ignorés : sinon les vacances d'été
    // imposeraient un 0 comme valeur dominante.
    const daysByCombo = new Map();
    for (let t = windowStart; t <= windowEnd; t += DAY_MS) {
        let esi = 0;
        let ess = 0;
        let active = false;

        for (const span of spans) {
            if (t >= span.from && t <= span.to) {
                esi += span.esi;
                ess += span.ess;
                active = true;
            }
        }

        if (!active) continue;
        const key = `${esi}|${ess}`;
        daysByCombo.set(key, (daysByCombo.get(key) || 0) + 1);
    }

    if (daysByCombo.size === 0) return null;

    const segments = [...daysByCombo.entries()].map(([key, days]) => {
        const [esi, ess] = key.split('|').map(Number);
        return { esi, ess, total: esi + ess, days };
    });

    return {
        esi: summarizeMetric(segments, (s) => s.esi),
        ess: summarizeMetric(segments, (s) => s.ess),
        total: summarizeMetric(segments, (s) => s.total)
    };
};

/** « 13 » si la valeur est stable, « 13 (11-15) » sinon. */
export const formatHours = ({ value, min, max }) =>
    min === max ? `${value}` : `${value} (${min}-${max})`;

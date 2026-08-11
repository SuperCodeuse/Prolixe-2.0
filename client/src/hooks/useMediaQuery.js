// hooks/useMediaQuery.js
import { useEffect, useState } from 'react';

/**
 * Retourne true tant que la media query correspond, et se met à jour au
 * redimensionnement. Remplace les lectures directes de `window.innerWidth`
 * pendant le rendu, qui n'étaient pas réactives et pouvaient diverger de ce
 * que le CSS appliquait réellement.
 */
export const useMediaQuery = (query) => {
    const getMatch = () =>
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia(query).matches
            : false;

    const [matches, setMatches] = useState(getMatch);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

        const mql = window.matchMedia(query);
        const onChange = (event) => setMatches(event.matches);

        setMatches(mql.matches);

        // Safari < 14 ne connaît que addListener
        if (mql.addEventListener) {
            mql.addEventListener('change', onChange);
            return () => mql.removeEventListener('change', onChange);
        }
        mql.addListener(onChange);
        return () => mql.removeListener(onChange);
    }, [query]);

    return matches;
};

export default useMediaQuery;

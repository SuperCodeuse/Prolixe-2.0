// utils/breakpoints.js
//
// Source unique des seuils responsive. Toute valeur ajoutée ici doit être
// répercutée dans `client/src/_breakpoints.scss` — les deux fichiers décrivent
// la même grille et doivent rester synchronisés.

export const BREAKPOINTS = {
    // Au-dessus : le menu latéral est fixé en permanence.
    menu: 1200,
    // En dessous : disposition téléphone (barre d'onglets basse, colonnes empilées).
    mobile: 768,
};

export const MEDIA = {
    menuFixed: `(min-width: ${BREAKPOINTS.menu}px)`,
    mobile: `(max-width: ${BREAKPOINTS.mobile}px)`,
};

export default BREAKPOINTS;

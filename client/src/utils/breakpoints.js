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
    // En dessous : les écrans « larges » (semaine du journal, 5 colonnes de
    // 200px) n'ont plus la place de cohabiter avec un menu déployé à 280px.
    // 280 (menu) + 64 (main-content) + 64 (journal-container) + 48 (section)
    // + 5×200 + 4×16 (grille) = 1520px.
    menuCollapse: 1520,
};

export const MEDIA = {
    menuFixed: `(min-width: ${BREAKPOINTS.menu}px)`,
    mobile: `(max-width: ${BREAKPOINTS.mobile}px)`,
    // Vrai quand un écran large doit replier le menu pour tenir sur une ligne.
    menuCollapse: `(max-width: ${BREAKPOINTS.menuCollapse - 1}px)`,
};

export default BREAKPOINTS;

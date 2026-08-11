// components/navigation/MobileTabBar.js
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, NotebookPen, CalendarClock, CheckSquare } from 'lucide-react';

import './MobileTabBar.scss';

// Les quatre destinations les plus utilisées, accessibles au pouce.
// Conseil de classe et Paramètres restent dans le tiroir latéral.
const TABS = [
    { to: '/dashboard', label: 'Accueil', Icon: LayoutDashboard },
    { to: '/journal', label: 'Journal', Icon: NotebookPen },
    { to: '/horaire', label: 'Horaire', Icon: CalendarClock },
    { to: '/correction', label: 'Corrections', Icon: CheckSquare },
];

const MobileTabBar = () => (
    <nav className="mobile-tabbar" aria-label="Navigation principale">
        {TABS.map(({ to, label, Icon }) => (
            <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `tabbar-link${isActive ? ' active' : ''}`}
            >
                <Icon className="tabbar-icon" size={22} aria-hidden="true" />
                <span className="tabbar-label">{label}</span>
            </NavLink>
        ))}
    </nav>
);

export default MobileTabBar;

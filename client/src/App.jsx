// App.jsx
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './components/navigation/SideMenu';
import MobileTabBar from './components/navigation/MobileTabBar';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import { useMediaQuery } from './hooks/useMediaQuery';
import { MEDIA } from './utils/breakpoints';
import Toast from './components/Toast';
import Login from './components/authentification/login';
import './App.scss';

// Écrans chargés à la demande : la page de connexion n'embarque plus le
// Journal, le générateur de PDF ni les dépendances de glisser-déposer.
const Register = lazy(() => import('./components/authentification/Register'));
const ResetPassword = lazy(() => import('./components/authentification/ResetPassword'));
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const Journal = lazy(() => import('./components/journal/Journal'));
const Horaire = lazy(() => import('./components/horaire/Horaire'));
const CorrectionList = lazy(() => import('./components/Correction/CorrectionList'));
const CorrectionView = lazy(() => import('./components/Correction/CorrectionView'));
const ConseilDeClasse = lazy(() => import('./components/cc/conseilClasse'));
const DocumentGenerator = lazy(() => import('./components/DocumentGenerator/DocumentGenerator'));
const Settings = lazy(() => import('./components/settings/Settings'));

const RouteFallback = () => (
    <div className="route-loading" role="status" aria-live="polite">
        <span className="route-spinner" aria-hidden="true"></span>
        Chargement…
    </div>
);

const AuthenticatedAppContent = ({ isMenuOpen, toggleMenu, closeMenu, isMenuFixed }) => (
    <>
        {!isMenuFixed && (
            <div
                className={`sidemenu-overlay${isMenuOpen ? ' open' : ''}`}
                onClick={closeMenu}
                aria-hidden="true"
            ></div>
        )}

        <SideMenu isMenuOpen={isMenuOpen} toggleMenu={toggleMenu} />

        <main className="main-content">
            {!isMenuFixed && (
                <button
                    className="menu-toggle-button"
                    onClick={toggleMenu}
                    aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                    aria-expanded={isMenuOpen}
                >
                    {isMenuOpen ? '✕' : '☰'}
                </button>
            )}

            <Suspense fallback={<RouteFallback />}>
                <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/journal" element={<Journal />} />
                    <Route path="/horaire" element={<Horaire />} />
                    <Route path="/correction" element={<CorrectionList />} />
                    <Route path="/conseilDeClasse" element={<ConseilDeClasse />} />
                    <Route path="/correction/:evaluationId" element={<CorrectionView />} />
                    <Route path="/document-generator" element={<DocumentGenerator />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Suspense>
        </main>

        <MobileTabBar />
    </>
);

// Composant principal
const App = () => {
    const { isAuthenticated, loadingAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { toasts, removeToast } = useToast();

    // Au-dessus du seuil, le menu est fixé et toujours visible.
    const isMenuFixed = useMediaQuery(MEDIA.menuFixed);
    const [isMenuOpen, setIsMenuOpen] = useState(isMenuFixed);

    // Le menu suit le seuil : ouvert d'office sur grand écran, replié en dessous.
    useEffect(() => {
        setIsMenuOpen(isMenuFixed);
    }, [isMenuFixed]);

    const toggleMenu = useCallback(() => {
        if (!isMenuFixed) setIsMenuOpen(prev => !prev);
    }, [isMenuFixed]);

    const closeMenu = useCallback(() => {
        if (!isMenuFixed) setIsMenuOpen(false);
    }, [isMenuFixed]);

    // Échap ferme le tiroir, et le fond ne défile plus derrière lui.
    useEffect(() => {
        const drawerOpen = isMenuOpen && !isMenuFixed;
        document.body.classList.toggle('no-scroll', drawerOpen);

        if (!drawerOpen) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') setIsMenuOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMenuOpen, isMenuFixed]);

    useEffect(() => () => document.body.classList.remove('no-scroll'), []);

    useEffect(() => {
        if (!loadingAuth && isAuthenticated) {
            const currentPath = location.pathname;
            if (currentPath === '/login' || currentPath === '/' || currentPath === '/register') {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [isAuthenticated, loadingAuth, navigate, location.pathname]);

    if (loadingAuth) {
        return <div className="loading-fullscreen">Chargement...</div>;
    }

    return (
        <div className={`app ${isMenuOpen ? 'menu-open' : 'menu-closed'}`}>
            {isAuthenticated ? (
                <AuthenticatedAppContent
                    isMenuOpen={isMenuOpen}
                    toggleMenu={toggleMenu}
                    closeMenu={closeMenu}
                    isMenuFixed={isMenuFixed}
                />
            ) : (
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </Suspense>
            )}

            <div className="toast-container">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        duration={toast.duration}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default App;

// App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import SideMenu from './components/navigation/SideMenu';
import Settings from './components/settings/Settings';
import Dashboard from './components/dashboard/Dashboard';
import Horaire from "./components/horaire/Horaire";
import Journal from "./components/journal/Journal";
import Login from './components/authentification/login';
import Register from './components/authentification/Register';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import Toast from './components/Toast';
import CorrectionList from "./components/Correction/CorrectionList";
import CorrectionView from "./components/Correction/CorrectionView";
import DocumentGenerator from "./components/DocumentGenerator/DocumentGenerator";
import './App.scss';
import ConseilDeClasse from "./components/cc/conseilClasse";


if (typeof window !== 'undefined') {
    const resizeObserverErr = 'ResizeObserver loop completed with undelivered notifications.';
    const originalError = console.error;

    console.error = (...args) => {
        if (args[0]?.includes?.(resizeObserverErr) || args[0]?.message?.includes?.(resizeObserverErr)) {
            return; // On ignore silencieusement
        }
        originalError.apply(console, args);
    };

    window.addEventListener('error', (e) => {
        if (e.message === resizeObserverErr) {
            e.stopImmediatePropagation();
        }
    });
}

const AuthenticatedAppContent = ({ isMenuOpen, toggleMenu }) => {
    const breakpoint = 1600;

    return (
        <>
            {isMenuOpen && window.innerWidth < breakpoint && (
                <div className="sidemenu-overlay" onClick={toggleMenu}></div>
            )}

            <SideMenu isMenuOpen={isMenuOpen} toggleMenu={toggleMenu} />
            <main className="main-content">
                <button className="menu-toggle-button" onClick={toggleMenu}>
                    {isMenuOpen ? '✕' : '☰'}
                </button>
                <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/journal" element={<Journal />} />
                    <Route path="/horaire" element={<Horaire />} />
                    <Route path="/correction" element={<CorrectionList />} />
                    <Route path="/conseilDeClasse" element={<ConseilDeClasse />} />
                    <Route path="/correction/:evaluationId" element={<CorrectionView />} />
                    <Route path="/document-generator" element={<DocumentGenerator />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </main>
        </>
    );
};

// Composant principal
const App = () => {
    const { isAuthenticated, loadingAuth } = useAuth();
    const navigate = useNavigate();
    const { toasts, removeToast } = useToast(); // Récupération des toasts

    const breakpoint = 1600;
    const [isMenuOpen, setIsMenuOpen] = useState(window.innerWidth >= breakpoint);


    useEffect(() => {
        let timeoutId;

        const handleResize = () => {
            clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                setIsMenuOpen(window.innerWidth >= breakpoint);
            }, 100);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, [breakpoint]);

    const toggleMenu = () => {
        if(window.innerWidth < breakpoint){
            setIsMenuOpen(prev => !prev);
        }
    }

    useEffect(() => {
        if (!loadingAuth) {
            const currentPath = window.location.pathname;
            if (isAuthenticated) {
                if (currentPath === '/login' || currentPath === '/' || currentPath === '/register') {
                    navigate('/dashboard', { replace: true });
                }
            } else {
                if (currentPath !== '/login' && currentPath !== '/register') {
                    navigate('./register', { replace: true });
                }
            }
        }
    }, [isAuthenticated, loadingAuth, navigate]);

    if (loadingAuth) {
        return <div className="loading-fullscreen">Chargement...</div>;
    }

    return (
        <div className={`app ${isMenuOpen ? 'menu-open' : 'menu-closed'}`}>
            {isAuthenticated ? (
                <AuthenticatedAppContent

                    isMenuOpen={isMenuOpen}
                    toggleMenu={toggleMenu}
                />
            ) : (
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="*" element={<Navigate to="/register" replace />} />
                </Routes>
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

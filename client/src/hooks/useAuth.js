import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const navigate = useNavigate();

    const logout = useCallback(() => {
        AuthService.logout();
        setUser(null);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
    }, [navigate]);

    useEffect(() => {
        const storedUser = AuthService.getCurrentUser();
        if (storedUser) {
            setUser(storedUser);
            setIsAuthenticated(true);
        }
        setLoadingAuth(false);

        // Écouter les erreurs d'authentification globales
        const handleAuthError = () => {
            logout();
        };
        window.addEventListener('auth-error', handleAuthError);

        return () => {
            window.removeEventListener('auth-error', handleAuthError);
        };
    }, [logout]);

    const login = useCallback(async (username, password, rememberMe) => {
        try {
            const response = await AuthService.login(username, password, rememberMe);
            if (response.success) {
                setUser(response.user);
                setIsAuthenticated(true);
                return { success: true };
            } else {
                return { success: false, message: response.message || 'Échec de la connexion' };
            }
        } catch (error) {
            return { success: false, message: error.message || 'Erreur inconnue' };
        }
    }, []);

    const resetPassword = useCallback(async (token, newPassword) => {
        try {
            const response = await AuthService.resetPassword(token, newPassword);

            if (response.success) {
                return { success: true, message: response.message };
            } else {
                return { success: false, message: response.message || 'Échec de la réinitialisation' };
            }
        } catch (error) {
            // On attrape l'erreur du service et on la formate pour le composant
            return { success: false, message: error.message || 'Erreur lors de la réinitialisation' };
        }
    }, []);

    // --- NOUVELLE FONCTION AJOUTÉE ---
    const sendPasswordResetEmail = useCallback(async (email) => {
        try {
            // On appelle la méthode correspondante dans ton AuthService
            const response = await AuthService.sendPasswordResetEmail(email);

            if (response.success) {
                return { success: true, message: response.message };
            } else {
                throw new Error(response.message || 'Impossible d\'envoyer l\'email de récupération.');
            }
        } catch (error) {
            // On propage l'erreur pour qu'elle soit attrapée par le composant Login
            throw error;
        }
    }, []);
    // ---------------------------------

    // On ajoute sendPasswordResetEmail dans la valeur du contexte
    const value = {
        user,
        isAuthenticated,
        loadingAuth,
        resetPassword,
        login,
        logout,
        sendPasswordResetEmail
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
    }
    return context;
};
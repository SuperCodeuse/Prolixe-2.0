// frontend/src/services/authService.js
import ApiService from './api';

class AuthService {
    static async login(username, password, rememberMe) {
        try {
            const response = await ApiService.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password, rememberMe })
            }, false);

            if (response.success) {
                // Choisir le stockage en fonction de "Rester connecté"
                const storage = rememberMe ? localStorage : sessionStorage;

                storage.setItem('authToken', response.token);
                storage.setItem('user', JSON.stringify(response.user));

                // On garde une trace du type de stockage pour le logout
                localStorage.setItem('rememberMe', rememberMe);
            }
            return response;
        } catch (error) {
            console.error('Erreur de connexion:', error);
            throw error;
        }
    }

    /**
     * Envoie un email de récupération de mot de passe
     */
    static async sendPasswordResetEmail(email) {
        try {
            const response = await ApiService.request('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            }, false);
            return response;
        } catch (error) {
            console.error('Erreur lors de la demande de reset:', error);
            throw error;
        }
    }

    /**
     * Change le mot de passe (pour l'utilisateur connecté)
     */
    static async resetPassword(token, newPassword) {
        try {
            // Utilise ApiService.request comme vos autres méthodes
            const response = await ApiService.request('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, newPassword })
            }, false); // false car la route est publique (l'utilisateur n'est pas connecté)

            return response;
        } catch (error) {
            console.error('Erreur lors de la réinitialisation du mdp:', error);
            throw error;
        }
    }

    static logout() {
        // On nettoie les deux au cas où
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('user');
    }

    static getCurrentUser() {
        // Vérifie d'abord dans le local, puis le session
        const user = localStorage.getItem('user') || sessionStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static getToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }
}

export default AuthService;
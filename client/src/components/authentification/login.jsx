import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Link } from "react-router-dom";
import './login.scss';

const Login = () => {
    const { login, sendPasswordResetEmail } = useAuth(); // On récupère la fonction de reset si elle existe
    const { error: showError, success: showSuccess } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // État pour basculer entre Connexion et Mot de passe oublié
    const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (forgotPasswordMode) {
            // Logique Mot de passe oublié
            try {
                await sendPasswordResetEmail(email);
                showSuccess('Un email de réinitialisation a été envoyé.');
                setForgotPasswordMode(false);
            } catch (err) {
                showError(err.message || 'Erreur lors de l\'envoi de l\'email.');
            }
        } else {
            // Logique Connexion classique
            if (!email || !password) {
                showError('Veuillez entrer votre email et votre mot de passe.');
                setIsSubmitting(false);
                return;
            }

            try {
                const result = await login(email, password, rememberMe);
                if (!result.success) {
                    showError(result.message || 'Échec de la connexion.');
                }
            } catch (err) {
                showError(err.message || 'Une erreur est survenue.');
            }
        }

        setIsSubmitting(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>{forgotPasswordMode ? 'Réinitialisation' : 'Connexion'}</h1>
                    <p>
                        {forgotPasswordMode
                            ? 'Entrez votre email pour recevoir un lien de récupération'
                            : 'Accédez à votre espace Prolixe'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email">Adresse e-mail</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="nom@exemple.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    {!forgotPasswordMode && (
                        <>
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label htmlFor="password">Mot de passe</label>
                                </div>
                                <input
                                    type="password"
                                    id="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isSubmitting}
                                    required
                                />

                                <span
                                    className="forgot-link"
                                    onClick={() => setForgotPasswordMode(true)}
                                    style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', cursor: 'pointer', marginBottom: '0.5rem', alignItems:'right'}}
                                >
                                        Oublié ?
                                </span>
                            </div>

                            <div className="remember-me-group">
                                <input
                                    type="checkbox"
                                    id="rememberMe"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    disabled={isSubmitting}
                                />
                                <label htmlFor="rememberMe">Rester connecté</label>
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary login-btn"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? 'Chargement...'
                            : (forgotPasswordMode ? 'Envoyer le lien' : 'Se connecter')}
                    </button>

                    {forgotPasswordMode && (
                        <button
                            type="button"
                            className="btn-link"
                            onClick={() => setForgotPasswordMode(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '1rem' }}
                        >
                            Retour à la connexion
                        </button>
                    )}
                </form>

                <div className="login-footer" style={{ marginTop: '2rem' }}>
                    <p>
                        Pas encore de compte ? <Link to="/register" style={{ color: 'var(--accent-blue)', fontWeight: '600' }}>S'inscrire</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
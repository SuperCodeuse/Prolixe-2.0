import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import './ResetPassword.scss';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const { resetPassword } = useAuth();
    const { error: showError, success: showSuccess } = useToast();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            return showError("Les mots de passe ne correspondent pas.");
        }

        setIsSubmitting(true);

        const result = await resetPassword(token, newPassword);

        if (result.success) {
            showSuccess(result.message || "Mot de passe mis à jour !");
            setTimeout(() => navigate('/login'), 2500);
        } else {
            showError(result.message || "Le lien est invalide ou a expiré.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="reset-password-container">
            <div className="reset-password-card">
                <div className="reset-header">
                    <h2>Nouveau mot de passe</h2>
                    <p>Définissez votre nouveau mot de passe Prolixe</p>
                </div>

                <form onSubmit={handleSubmit} className="reset-form">
                    <div className="form-group">
                        <label>Nouveau mot de passe</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={isSubmitting}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirmation</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isSubmitting}
                            required
                        />
                    </div>
                    <button type="submit" className="reset-btn" disabled={isSubmitting}>
                        {isSubmitting ? 'Chargement...' : 'Mettre à jour'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // Pour générer un token aléatoire sécurisé

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const SHORT_LIVED_TOKEN_EXPIRATION = '1h';
const LONG_LIVED_TOKEN_EXPIRATION = '30d';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

class AuthController {

    static handleError(res, error, defaultMessage = 'Erreur serveur', statusCode = 500) {
        const errorMessage = process.env.NODE_ENV === 'development' ? error.message : defaultMessage;
        console.error(`❌ Erreur dans AuthController: ${defaultMessage}`, error);

        res.status(statusCode).json({
            success: false,
            message: defaultMessage,
            error: errorMessage,
        });
    }

    static async login(req, res) {
        const { username, password, rememberMe } = req.body;
        const pool = req.pool;

        if (!username || !password) {
            return AuthController.handleError(res, new Error('Identifiants manquants'), 'Email et mot de passe sont requis.', 400);
        }

        try {
            const connection = await pool.getConnection();
            const [rows] = await connection.execute('SELECT * FROM USER WHERE email = ?', [username]);
            connection.release();

            if (rows.length === 0) {
                return AuthController.handleError(res, new Error('Utilisateur non trouvé'), 'Email ou mot de passe incorrect.', 401);
            }

            const user = rows[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return AuthController.handleError(res, new Error('Mot de passe incorrect'), 'Email ou mot de passe incorrect.', 401);
            }

            const userPayload = {
                id: user.id,
                email: user.email,
                role: user.role,
                firstname: user.firstname,
                name: user.name
            };

            const expiresIn = rememberMe ? LONG_LIVED_TOKEN_EXPIRATION : SHORT_LIVED_TOKEN_EXPIRATION;
            const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: expiresIn });

            res.json({
                success: true,
                message: 'Connexion réussie !',
                token: token,
                user: userPayload
            });

        } catch (error) {
            AuthController.handleError(res, error, 'Erreur lors de la connexion.');
        }
    }

    static async forgotPassword(req, res) {
        const { email } = req.body;
        const pool = req.pool;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email requis." });
        }

        try {
            const connection = await pool.getConnection();

            // 1. Vérifier si l'utilisateur existe
            const [rows] = await connection.execute('SELECT id, firstname FROM USER WHERE email = ?', [email]);

            if (rows.length > 0) {
                const user = rows[0];

                // 2. Générer un token unique et une expiration (ex: 1 heure)
                const resetToken = crypto.randomBytes(32).toString('hex');
                const resetExpires = new Date(Date.now() + 3600000); // +1 heure

                // 3. Stocker le token en BDD (Assurez-vous d'avoir ces colonnes dans votre table USER)
                await connection.execute(
                    'UPDATE USER SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
                    [resetToken, resetExpires, user.id]
                );

                // 4. Préparer l'URL de réinitialisation (Lien vers votre Front-end)
                const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

                // 5. Envoyer le mail
                const mailOptions = {
                    from: `"Support Mon App" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Réinitialisation de votre mot de passe',
                    html: `
                        <h1>Bonjour ${user.firstname || ''}</h1>
                        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                        <p>Veuillez cliquer sur le lien ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 1 heure.</p>
                        <a href="${resetUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Réinitialiser mon mot de passe</a>
                        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
                    `
                };

                await transporter.sendMail(mailOptions);
            }

            connection.release();

            // Note: On renvoie toujours "success" même si l'email n'existe pas pour éviter le "User Enumeration"
            res.status(200).json({
                success: true,
                message: "Si cet email est associé à un compte, un lien de réinitialisation sera envoyé sous peu."
            });

        } catch (error) {
            console.error('Erreur forgotPassword:', error);
            res.status(500).json({ success: false, message: "Erreur lors de la demande de réinitialisation." });
        }
    }

    static async resetPassword(req, res) {
        const { token, newPassword } = req.body;
        const pool = req.pool;

        if (!token || !newPassword) {
            return res.status(400).json({ success: false, message: "Token et nouveau mot de passe requis." });
        }

        try {
            const connection = await pool.getConnection();

            // 1. Chercher l'utilisateur avec ce token et vérifier l'expiration
            const [rows] = await connection.execute(
                'SELECT id FROM USER WHERE reset_token = ? AND reset_token_expires > NOW()',
                [token]
            );

            if (rows.length === 0) {
                connection.release();
                return res.status(400).json({ success: false, message: "Le lien est invalide ou a expiré." });
            }

            const userId = rows[0].id;

            // 2. Hasher le nouveau mot de passe
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // 3. Mettre à jour le mot de passe et supprimer le token
            await connection.execute(
                'UPDATE USER SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
                [hashedPassword, userId]
            );

            connection.release();
            res.json({ success: true, message: "Votre mot de passe a été réinitialisé avec succès !" });

        } catch (error) {
            console.error('Erreur resetPassword:', error);
            res.status(500).json({ success: true, message: "Erreur lors de la réinitialisation." });
        }
    }
}

module.exports = AuthController;
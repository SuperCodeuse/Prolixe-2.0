// backend/middlewares/roleMiddleware.js

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        return res.status(403).json({
            success: false,
            message: 'Accès interdit. Seuls les administrateurs peuvent effectuer cette action.'
        });
    }
};

module.exports = { isAdmin };
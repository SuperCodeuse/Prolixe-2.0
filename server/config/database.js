// backend/config/database.js - MISE À JOUR
const mysql = require('mysql2/promise');

const config = {
    host: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dateStrings: true,
    ssl: {
        rejectUnauthorized: false
    },
    connectTimeout: 30000,
    connectionLimit: 10,
    queueLimit: 0,
    idleTimeout: 300000,
    acquireTimeout: 60000,
    timeout: 60000
};

// Créez le pool directement ici et exportez-le
const pool = mysql.createPool(config);
console.log(`📍 Serveur: ${config.host}:${config.port}`);

// Test de connexion au démarrage (peut rester une fonction séparée si vous le souhaitez)
const testConnection = async () => {
    try {
        const connection = await pool.getConnection(); // Utilise le pool créé
        const [rows] = await connection.execute('SELECT 1 as test');
        connection.release(); // Libérer la connexion après le test
        return true;
    } catch (error) {
        console.error('❌ Test de connexion échoué:', error);
        return false;
    }
};

module.exports = pool; // <-- EXPORTEZ DIRECTEMENT LE POOL
// Vous pouvez exporter testConnection aussi si vous en avez besoin ailleurs, par exemple :
// module.exports = { pool, testConnection };
// Mais pour ClassController, juste 'pool' est suffisant si vous changez l'import.
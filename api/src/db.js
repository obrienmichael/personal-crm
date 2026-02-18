const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'personal_crm'
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;

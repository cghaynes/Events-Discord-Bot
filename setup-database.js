require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupDatabase() {
    let connection;

    try {
        // First connect without database to create it
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
        });

        console.log('Connected to MySQL server');

        // Create database if it doesn't exist
        const dbName = process.env.DB_NAME || 'eventsbot';
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        console.log(`✅ Database '${dbName}' created or already exists`);

        // Use the database
        await connection.query(`USE ${dbName}`);

        // Create events table
        const createEventsTable = `
            CREATE TABLE IF NOT EXISTS events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_name VARCHAR(255) NOT NULL,
                description TEXT,
                event_date DATETIME NOT NULL,
                host_type ENUM('user', 'group') NOT NULL,
                host_id VARCHAR(255) NOT NULL,
                host_name VARCHAR(255) NOT NULL,
                image_url TEXT,
                created_by VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                guild_id VARCHAR(255) NOT NULL,
                INDEX idx_guild_id (guild_id),
                INDEX idx_event_date (event_date),
                INDEX idx_host_id (host_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await connection.query(createEventsTable);
        console.log('✅ Events table created or already exists');

        console.log('\n🎉 Database setup completed successfully!');

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run setup
setupDatabase();

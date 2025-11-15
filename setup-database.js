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
                image_url TEXT,
                created_by VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                guild_id VARCHAR(255) NOT NULL,
                INDEX idx_guild_id (guild_id),
                INDEX idx_event_date (event_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await connection.query(createEventsTable);
        console.log('✅ Events table created or already exists');

        // Check if old host columns exist and drop them (migration)
        try {
            const [columns] = await connection.query(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'events' AND COLUMN_NAME IN ('host_type', 'host_id', 'host_name')
            `, [dbName]);

            if (columns.length > 0) {
                console.log('🔄 Migrating database schema - removing host columns...');

                // Drop the host_id index if it exists
                await connection.query('ALTER TABLE events DROP INDEX IF EXISTS idx_host_id');

                // Drop the host columns
                await connection.query('ALTER TABLE events DROP COLUMN IF EXISTS host_type');
                await connection.query('ALTER TABLE events DROP COLUMN IF EXISTS host_id');
                await connection.query('ALTER TABLE events DROP COLUMN IF EXISTS host_name');

                console.log('✅ Host columns removed successfully');
            }
        } catch (error) {
            console.log('ℹ️ No migration needed or already completed');
        }

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

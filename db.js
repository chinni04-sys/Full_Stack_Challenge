const mysql = require('mysql2/promise');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

let pool;

async function initDB() {
  try {
    // 1. Connect without database to create it if it doesn't exist
    const connection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || 'store_rating_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    // 2. Initialize the pool with the database specified
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Database pool initialized for database: ${dbName}`);

    // 3. Create tables
    await createTables();

    // 4. Seed admin user
    await seedAdmin();

  } catch (error) {
    console.error('Error during database initialization:', error);
    process.exit(1);
  }
}

async function createTables() {
  const usersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(60) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      address VARCHAR(400) NOT NULL,
      role ENUM('SYSTEM_ADMIN', 'NORMAL_USER', 'STORE_OWNER') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const ratingsTableQuery = `
    CREATE TABLE IF NOT EXISTS ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL,
      user_id INT NOT NULL,
      rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_store_user (store_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(usersTableQuery);
  console.log('Users table checked/created.');
  await pool.query(ratingsTableQuery);
  console.log('Ratings table checked/created.');
}

async function seedAdmin() {
  const adminEmail = 'admin@admin.com';
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [adminEmail]);

  if (rows.length === 0) {
    // Admin password needs to satisfy the complexity requirements:
    // 8-16 characters, must include at least one uppercase letter and one special character.
    // 'Admin@123!' has length 10, uppercase 'A', special '!' and numbers.
    const hashedPassword = await bcrypt.hash('Admin@123!', 10);
    const adminUser = {
      name: 'System Administrator Account', // needs to be min 20, max 60 chars. Length is 30.
      email: adminEmail,
      password: hashedPassword,
      address: 'System Admin Office HQ, Main Street', // max 400
      role: 'SYSTEM_ADMIN'
    };

    await pool.query(
      'INSERT INTO users (name, email, password, address, role) VALUES (?, ?, ?, ?, ?)',
      [adminUser.name, adminUser.email, adminUser.password, adminUser.address, adminUser.role]
    );
    console.log('Default Admin user seeded successfully.');
  } else {
    console.log('Admin user already exists.');
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDB first.');
  }
  return pool;
}

module.exports = {
  initDB,
  getPool
};

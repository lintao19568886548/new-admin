import { createDatabase } from 'db0';
import sqlite from 'db0/connectors/better-sqlite3';

// Initiate database with SQLite connector
const db = createDatabase(sqlite({}));

const test = async () => {
  // Create users table
  await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  // Add a new user
  const userId = '1001';
  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;
  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
  return rows;
};

// Query for users
export default eventHandler(async () => {
  const data = test();
  return data; // Return the result
});

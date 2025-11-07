// ============================================================================
// DATABASE CLIENT - Smart Selection (Turso vs SQLite)
// Production: Turso (serverless) | Development: SQLite fallback
// ============================================================================

/**
 * Database provider selection logic:
 * 1. Check for TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 * 2. If both present → Use Turso (production/staging)
 * 3. If missing → Fallback to SQLite (local development)
 */

const useTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

if (useTurso) {
  console.log('🗄️ Database: TURSO (Serverless - Production Mode)');
  console.log('   URL:', process.env.TURSO_DATABASE_URL?.replace(/\/\/.*@/, '//*****@'));
} else {
  console.log('🗄️ Database: SQLite (Local - Development Mode)');
  console.log('   ⚠️  Production requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN');
}

// ============================================================================
// EXPORTS - Dynamic based on environment
// ============================================================================

// Import both adapters
import * as TursoAdapter from './turso-adapter';
import * as SQLiteAdapter from './sqlite-client';
import * as TursoClient from './turso-client';

// Export TenderDatabase and getDatabase based on environment
export const TenderDatabase = (useTurso ? TursoAdapter.TenderDatabase : SQLiteAdapter.TenderDatabase) as typeof TursoAdapter.TenderDatabase;
export const getDatabase = useTurso ? TursoAdapter.getDatabase : SQLiteAdapter.getDatabase;

// Export Turso utilities (only available in Turso mode)
export const executeQuery = useTurso ? TursoClient.executeQuery : undefined;
export const executeQuerySingle = useTurso ? TursoClient.executeQuerySingle : undefined;
export const executeWrite = useTurso ? TursoClient.executeWrite : undefined;
export const getTursoClient = useTurso ? TursoClient.getTursoClient : undefined;

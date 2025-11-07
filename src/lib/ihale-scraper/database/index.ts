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

// Export based on environment
export const { TenderDatabase, getDatabase } = useTurso
  ? require('./turso-adapter')
  : require('./sqlite-client');

// Export query utilities (Turso-specific, but not needed for SQLite)
export const { executeQuery, executeQuerySingle, executeWrite, getTursoClient } = useTurso
  ? require('./turso-client')
  : {
      executeQuery: undefined,
      executeQuerySingle: undefined,
      executeWrite: undefined,
      getTursoClient: undefined,
    };

// ============================================================================
// DATABASE CLIENT (Turso Only)
// Always use Turso - works for both local and production
// ============================================================================

console.log('🗄️ Database: TURSO (Serverless SQLite)');

// Always use Turso
export { TenderDatabase, getDatabase } from './turso-adapter';
export { executeQuery, executeQuerySingle, executeWrite, getTursoClient } from './turso-client';

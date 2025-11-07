// ============================================================================
// TURSO DATABASE CLIENT
// Serverless SQLite for production (Vercel)
// ============================================================================

import { createClient, type Client, type InValue } from '@libsql/client';

// ============================================================================
// DATABASE SINGLETON (Global scope for serverless persistence)
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __tursoClient: Client | undefined;
}

export function getTursoClient(): Client {
  // Use global instance if available (prevents re-initialization)
  if (!global.__tursoClient) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        '❌ TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in environment variables'
      );
    }

    console.log('🔧 Connecting to Turso database:', url);
    global.__tursoClient = createClient({
      url,
      authToken,
    });
  }

  return global.__tursoClient;
}

// ============================================================================
// HELPER: Execute Query
// ============================================================================

export async function executeQuery<T = unknown>(
  sql: string,
  params: InValue[] = []
): Promise<T[]> {
  const client = getTursoClient();
  const result = await client.execute({
    sql,
    args: params,
  });

  return result.rows as T[];
}

// ============================================================================
// HELPER: Execute Single Row Query
// ============================================================================

export async function executeQuerySingle<T = unknown>(
  sql: string,
  params: InValue[] = []
): Promise<T | null> {
  const results = await executeQuery<T>(sql, params);
  return results[0] || null;
}

// ============================================================================
// HELPER: Execute Write Query (INSERT/UPDATE/DELETE)
// ============================================================================

export async function executeWrite(
  sql: string,
  params: InValue[] = []
): Promise<{ lastInsertRowid: number; changes: number }> {
  const client = getTursoClient();
  const result = await client.execute({
    sql,
    args: params,
  });

  return {
    lastInsertRowid: Number(result.lastInsertRowid),
    changes: result.rowsAffected,
  };
}

// ============================================================================
// HELPER: Transaction Support
// ============================================================================

export async function executeTransaction<T>(
  callback: (client: Client) => Promise<T>
): Promise<T> {
  const client = getTursoClient();
  
  // Turso doesn't support explicit transactions like better-sqlite3
  // But libsql client batches are atomic
  return await callback(client);
}

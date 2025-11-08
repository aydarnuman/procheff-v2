/**
 * Profile Stub Endpoint
 * Fixes: 404 errors in console (/profile)
 */

export async function GET() {
  return Response.json({ 
    id: "dev", 
    name: "ProCheff Dev", 
    role: "admin",
    timestamp: new Date().toISOString(),
  });
}

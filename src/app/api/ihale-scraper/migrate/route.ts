import { NextResponse } from 'next/server';

// This route is no longer needed with SQLite (TEXT fields have no length limit)
export async function POST(request: Request) {
  return NextResponse.json({
    success: true,
    message: 'Migration route is deprecated - SQLite uses TEXT fields with no length limits',
    info: 'This endpoint is no longer needed as SQLite TEXT fields have no length constraints',
  });
}

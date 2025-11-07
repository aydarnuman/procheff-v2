// ============================================================================
// API: UPLOAD FILE TO SESSION
// POST /api/tender/session/upload
// ⚠️ SIMPLIFIED VERSION - File storage not fully implemented yet
// ============================================================================

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // TODO: Implement file upload with UnifiedFileStorage
    // For now, return not implemented
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'File upload feature is being migrated. Use direct analysis endpoint instead.' 
      },
      { status: 501 } // Not Implemented
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

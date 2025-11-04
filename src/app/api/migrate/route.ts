import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Migrations must be run in Supabase SQL Editor',
    instructions: {
      step1: 'Go to Supabase Dashboard > SQL Editor',
      step2: 'Copy the SQL from scripts/apply-migrations.sql',
      step3: 'Paste and run it',
      sql_file: '/scripts/apply-migrations.sql'
    }
  });
}

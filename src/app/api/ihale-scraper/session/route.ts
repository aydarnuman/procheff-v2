import { NextResponse } from 'next/server';
import fs from 'fs';

export async function GET() {
  try {
    const sessionData = fs.readFileSync('/tmp/ihalebul-session.json', 'utf8');
    const session = JSON.parse(sessionData);

    // Calculate session age in minutes
    const sessionAge = Date.now() - new Date(session.timestamp).getTime();
    const ageMinutes = Math.round(sessionAge / 60000);

    // Session is active if less than 1 hour old
    const isActive = sessionAge < 3600000; // 1 hour = 3600000 ms

    return NextResponse.json({
      active: isActive,
      ageMinutes,
      timestamp: session.timestamp,
    });
  } catch (error) {
    // No session file found or error reading it
    return NextResponse.json({
      active: false,
      ageMinutes: null,
      timestamp: null,
    });
  }
}

import { NextResponse } from "next/server";

export default function NotFound() {
  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

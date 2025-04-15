import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export async function GET() {
  try {
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const keyContent = readFileSync(keyPath, "utf8");
    const credentials = JSON.parse(keyContent);

    return NextResponse.json({
      message: "Service account key file found and parsed successfully",
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to read service account key file",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

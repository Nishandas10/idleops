import { type NextRequest, NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import path from "path";

interface VMActionRequest {
  instanceId: string;
  zone: string;
}

// Next.js dynamic route: app/api/instances/[action]/route.ts
export async function POST(
  req: NextRequest,
  context: { params: { action: string } }
) {
  const { action } = context.params;

  // Validate action
  if (!["start", "stop"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  try {
    // Validate and parse request body
    const body = (await req.json()) as Partial<VMActionRequest>;
    const { instanceId, zone } = body;

    if (!instanceId || !zone) {
      return NextResponse.json(
        { error: "Missing 'instanceId' or 'zone'" },
        { status: 400 }
      );
    }

    // Load service account credentials
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const credentials = JSON.parse(readFileSync(keyPath, "utf-8"));

    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/compute"],
    });

    const instancesClient = new InstancesClient({ auth });

    const vmRequest = {
      project: process.env.GCP_PROJECT_ID!,
      zone,
      instance: instanceId,
    };

    // Execute start or stop
    const [operation] =
      action === "start"
        ? await instancesClient.start(vmRequest)
        : await instancesClient.stop(vmRequest);

    return NextResponse.json({
      message: `VM ${action} operation started.`,
      operationName: operation.name,
    });
  } catch (error: any) {
    console.error("Error performing VM action:", error);
    return NextResponse.json(
      { error: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}

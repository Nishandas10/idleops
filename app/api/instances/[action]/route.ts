import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import path from "path";

interface VMActionRequest {
  instanceId: string;
  zone: string;
}

export async function POST(
  request: NextRequest,
  context: { params: { action: string } }
) {
  const { action } = context.params;

  if (action !== "start" && action !== "stop") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  try {
    const body: VMActionRequest = await request.json();

    if (!body.instanceId || !body.zone) {
      return NextResponse.json(
        { error: "Instance ID and zone are required" },
        { status: 400 }
      );
    }

    // Load and parse the service account key
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const keyContent = readFileSync(keyPath, "utf8");
    const credentials = JSON.parse(keyContent);

    // Create auth client with appropriate scope
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/compute"],
    });

    // Initialize client with auth
    const instancesClient = new InstancesClient({ auth });

    // Prepare the request based on the action
    const vmRequest = {
      project: process.env.GCP_PROJECT_ID!,
      zone: body.zone,
      instance: body.instanceId,
    };

    // Execute the appropriate action
    const [operation] =
      action === "start"
        ? await instancesClient.start(vmRequest)
        : await instancesClient.stop(vmRequest);

    return NextResponse.json({
      message: `VM instance ${action} operation initiated`,
      operationName: operation.name,
    });
  } catch (err) {
    console.error("Error details:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      error: err,
    });

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : `Failed to ${action} VM instance`,
        details: err,
      },
      { status: 500 }
    );
  }
}

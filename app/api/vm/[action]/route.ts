import { NextRequest, NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  // Get the action from params (start or stop)
  const action = params.action;

  // Validate action
  if (action !== "start" && action !== "stop") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  try {
    // Parse request body
    const body = await request.json();
    const { instanceId, zone } = body;

    if (!instanceId || !zone) {
      return NextResponse.json(
        { error: "Instance ID and zone are required" },
        { status: 400 }
      );
    }

    // Load service account key
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const keyContent = readFileSync(keyPath, "utf8");
    const credentials = JSON.parse(keyContent);

    // Create auth client
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/compute"],
    });

    // Initialize Compute client
    const instancesClient = new InstancesClient({ auth });

    // Prepare the request
    const vmRequest = {
      project: process.env.GCP_PROJECT_ID || credentials.project_id,
      zone,
      instance: instanceId,
    };

    // Execute action
    const [operation] =
      action === "start"
        ? await instancesClient.start(vmRequest)
        : await instancesClient.stop(vmRequest);

    // Return success response
    return NextResponse.json({
      success: true,
      message: `VM instance ${action} operation initiated`,
      operationName: operation.name,
    });
  } catch (error) {
    console.error(`Error in ${action} VM:`, error);

    // Return error response
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : `Failed to ${action} VM instance`,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import path from "path";

// Define the expected shape of the JSON payload
interface VMActionRequest {
  instanceId: string;
  zone: string;
}

// This route handler responds to POST requests at /api/instances/[action]
export async function POST(
  req: NextRequest,
  { params }: { params: Record<string, string> }
): Promise<NextResponse> {
  // Retrieve the dynamic "action" from the URL
  const action = params.action;

  // Validate that action is either "start" or "stop"
  if (!action || (action !== "start" && action !== "stop")) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  try {
    // Parse the request body safely
    const body = (await req.json()) as Partial<VMActionRequest>;
    const { instanceId, zone } = body;

    if (!instanceId || !zone) {
      return NextResponse.json(
        { error: "Missing 'instanceId' or 'zone'" },
        { status: 400 }
      );
    }

    // Load the service account key from the file system
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const keyContent = readFileSync(keyPath, "utf8");
    const credentials = JSON.parse(keyContent);

    // Create a GoogleAuth client with the proper scopes
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/compute"],
    });

    // Initialize the Compute instances client with authentication
    const instancesClient = new InstancesClient({ auth });

    // Build the request object for Google Cloud Compute API
    const vmRequest = {
      project: process.env.GCP_PROJECT_ID!, // Ensure this env var is defined
      zone,
      instance: instanceId,
    };

    // Execute the appropriate action based on the URL param
    const [operation] =
      action === "start"
        ? await instancesClient.start(vmRequest)
        : await instancesClient.stop(vmRequest);

    return NextResponse.json({
      message: `VM ${action} operation initiated.`,
      operationName: operation.name,
    });
  } catch (error: any) {
    console.error("Error executing VM action:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

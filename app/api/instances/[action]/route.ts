import { NextRequest, NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";

interface VMActionRequest {
  instanceId: string;
  zone: string;
}

// Fixed: Properly type params as a Promise and await it
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
): Promise<NextResponse> {
  const { action } = await params;

  if (action !== "start" && action !== "stop") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  try {
    const body = (await req.json()) as Partial<VMActionRequest>;
    const { instanceId, zone } = body;
    if (!instanceId || !zone) {
      return NextResponse.json(
        { error: "Missing 'instanceId' or 'zone'" },
        { status: 400 }
      );
    }

    // Get service account credentials from environment variable
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || "{}");

    if (!credentials.project_id) {
      throw new Error("Invalid GCP service account configuration");
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/compute"],
    });

    const instancesClient = new InstancesClient({ auth });

    // Build the request for the Compute API
    const vmRequest = {
      project: process.env.GCP_PROJECT_ID!, // make sure this env var is set
      zone,
      instance: instanceId,
    };

    // Execute the appropriate method based on action
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

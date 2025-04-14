import { NextRequest, NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import path from "path";

interface VMActionRequest {
  instanceId: string;
  zone: string;
}

// In Next.js 15, the dynamic route parameter can be destructured directly from the second argument.
export async function POST(
  req: NextRequest,
  { params: { action } }: { params: { action: string } }
): Promise<NextResponse> {
  if (action !== "start" && action !== "stop") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'start' or 'stop'" },
      { status: 400 }
    );
  }

  try {
    // Parse the JSON body with basic type validation
    const body = (await req.json()) as Partial<VMActionRequest>;
    const { instanceId, zone } = body;
    if (!instanceId || !zone) {
      return NextResponse.json(
        { error: "Missing 'instanceId' or 'zone'" },
        { status: 400 }
      );
    }

    // Load service account credentials from file system
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const credentials = JSON.parse(readFileSync(keyPath, "utf8"));

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

import {
  InstancesClient,
  ZonesClient,
} from "@google-cloud/compute/build/src/v1";
import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

interface VMInstance {
  id: string;
  name: string;
  zone: string;
  status: string;
  labels: Record<string, string>;
}

export async function GET() {
  console.log("Starting VM instances fetch...");
  console.log("Project ID:", process.env.GCP_PROJECT_ID);

  try {
    // Get service account credentials from environment variable
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || "{}");

    if (!credentials.project_id) {
      throw new Error("Invalid GCP service account configuration");
    }

    // Create auth client
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/compute.readonly"],
    });

    // Initialize clients with auth
    const zonesClient = new ZonesClient({ auth });
    const instancesClient = new InstancesClient({ auth });

    console.log("Fetching zones...");
    const [zonesList] = await zonesClient.list({
      project: process.env.GCP_PROJECT_ID,
    });
    console.log("Found zones:", zonesList.length);

    // Create an array of promises for fetching instances from each zone
    const instancePromises = zonesList
      .filter((zone) => zone.name) // Filter out zones without names
      .map(async (zone) => {
        try {
          console.log("Fetching instances from zone:", zone.name);
          const [instancesList] = await instancesClient.list({
            project: process.env.GCP_PROJECT_ID,
            zone: zone.name!,
          });

          console.log(
            `Found ${instancesList.length} instances in zone ${zone.name}`
          );

          return instancesList.map(
            (instance): VMInstance => ({
              id: String(instance.id || ""),
              name: instance.name || "",
              zone: zone.name || "",
              status: instance.status || "",
              labels: instance.labels || {},
            })
          );
        } catch (zoneError) {
          console.error(
            `Error fetching instances from zone ${zone.name}:`,
            zoneError
          );
          return [] as VMInstance[]; // Return empty array for failed zones
        }
      });

    // Wait for all zone requests to complete in parallel
    const instancesArrays = await Promise.all(instancePromises);

    // Flatten the array of arrays into a single array of instances
    const allInstances: VMInstance[] = instancesArrays.flat();

    console.log(`Total instances found: ${allInstances.length}`);
    return NextResponse.json(allInstances);
  } catch (err) {
    console.error("Error details:", {
      message: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack : undefined,
      error: err,
    });

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch VM instances",
        details: err,
      },
      { status: 500 }
    );
  }
}

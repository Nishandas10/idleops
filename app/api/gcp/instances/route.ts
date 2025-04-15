import { NextRequest, NextResponse } from "next/server";

interface Instance {
  id: string;
  name: string;
  zone: string;
  status: string;
  machineType: string;
  labels?: Record<string, string>;
  networkInterfaces?: any[];
  disks?: any[];
  creationTimestamp?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authentication token" },
        { status: 401 }
      );
    }

    // Extract the token - this is the user's GCP OAuth token
    const token = authHeader.substring(7);

    // Get the project ID from the query parameter
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId parameter" },
        { status: 400 }
      );
    }

    console.log(`Fetching GCP instances for project: ${projectId}`);

    // First, get a list of zones in the project
    const zonesResponse = await fetch(
      `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!zonesResponse.ok) {
      const errorText = await zonesResponse.text();
      console.error(
        `Error fetching GCP zones: Status ${zonesResponse.status}`,
        errorText
      );

      // Special handling for auth errors
      if (zonesResponse.status === 401 || zonesResponse.status === 403) {
        console.error("Authentication error accessing GCP zones API");
        return NextResponse.json(
          {
            error: "Authentication error with Google Cloud",
            details:
              "You do not have permission to access this project. Make sure you're signed in with the correct Google account.",
          },
          { status: zonesResponse.status }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch GCP zones", details: errorText },
        { status: zonesResponse.status }
      );
    }

    const zonesData = await zonesResponse.json();
    const zones = zonesData.items || [];

    console.log(`Found ${zones.length} zones in project ${projectId}`);

    // For each zone, fetch instances
    const instancesPromises = zones.map(async (zone: any) => {
      const zoneName = zone.name;

      try {
        console.log(`Fetching instances in zone: ${zoneName}`);

        const instancesResponse = await fetch(
          `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones/${zoneName}/instances`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!instancesResponse.ok) {
          const errorText = await instancesResponse.text();
          console.warn(
            `Error fetching instances in zone ${zoneName}: Status ${instancesResponse.status}`,
            errorText
          );
          return [];
        }

        const instancesData = await instancesResponse.json();
        const instances = instancesData.items || [];

        console.log(`Found ${instances.length} instances in zone ${zoneName}`);

        return instances.map((instance: any) => {
          // Extract machine type name from the URL
          const machineTypeUrl = instance.machineType || "";
          const machineTypeParts = machineTypeUrl.split("/");
          const machineType = machineTypeParts[machineTypeParts.length - 1];

          return {
            id: instance.id || "",
            name: instance.name || "",
            zone: zoneName,
            status: instance.status || "",
            machineType: machineType || "Unknown",
            labels: instance.labels || {},
            networkInterfaces: instance.networkInterfaces || [],
            disks: instance.disks || [],
            creationTimestamp: instance.creationTimestamp || "",
          };
        });
      } catch (error) {
        console.error(`Error fetching instances in zone ${zoneName}:`, error);
        return [];
      }
    });

    // Wait for all zone instance fetches to complete
    const instanceArrays = await Promise.all(instancesPromises);

    // Flatten the arrays
    const instances: Instance[] = instanceArrays.flat();

    console.log(
      `Successfully fetched ${instances.length} VM instances across all zones`
    );

    return NextResponse.json({ instances });
  } catch (error) {
    console.error("Error in GCP instances API:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch GCP instances",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

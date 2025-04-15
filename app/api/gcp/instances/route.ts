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
      const error = await zonesResponse.text();
      console.error("Error fetching GCP zones:", error);

      return NextResponse.json(
        { error: "Failed to fetch GCP zones", details: error },
        { status: zonesResponse.status }
      );
    }

    const zonesData = await zonesResponse.json();
    const zones = zonesData.items || [];

    // For each zone, fetch instances
    const instancesPromises = zones.map(async (zone: any) => {
      const zoneName = zone.name;

      try {
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
          console.warn(
            `Error fetching instances in zone ${zoneName}:`,
            await instancesResponse.text()
          );
          return [];
        }

        const instancesData = await instancesResponse.json();
        const instances = instancesData.items || [];

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

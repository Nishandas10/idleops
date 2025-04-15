import { NextRequest, NextResponse } from "next/server";

interface Project {
  id: string;
  name: string;
  projectId: string;
  createTime?: string;
  labels?: Record<string, string>;
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

    console.log("Fetching GCP projects with user's OAuth token");

    // Call the GCP Resource Manager API to list projects
    const response = await fetch(
      "https://cloudresourcemanager.googleapis.com/v1/projects",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Error fetching GCP projects: Status ${response.status}`,
        errorText
      );

      // Special handling for auth errors
      if (response.status === 401 || response.status === 403) {
        console.error("Authentication error accessing GCP projects API");
        return NextResponse.json(
          {
            error: "Authentication error with Google Cloud",
            details:
              "You do not have permission to list projects. Make sure you're signed in with the correct Google account.",
          },
          { status: response.status }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch GCP projects", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log number of projects found
    const projectCount = data.projects?.length || 0;
    console.log(`Successfully fetched ${projectCount} GCP projects`);

    // Transform the response to our desired format
    const projects: Project[] = (data.projects || []).map((project: any) => ({
      id: project.projectNumber || "",
      name: project.name || "",
      projectId: project.projectId || "",
      createTime: project.createTime || "",
      labels: project.labels || {},
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error in GCP projects API:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch GCP projects",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

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
      const error = await response.text();
      console.error("Error fetching GCP projects:", error);

      return NextResponse.json(
        { error: "Failed to fetch GCP projects", details: error },
        { status: response.status }
      );
    }

    const data = await response.json();

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

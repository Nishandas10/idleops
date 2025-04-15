/**
 * Utility functions for handling service account keys
 */

/**
 * Fetches the service account key for a specific project
 * @param projectId - The GCP project ID
 * @param token - The Firebase auth token
 * @returns The service account key object
 */
export const fetchServiceAccountKey = async (
  projectId: string,
  token: string
): Promise<any> => {
  try {
    const response = await fetch(
      `/api/user/service-account?projectId=${projectId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch service account key");
    }

    const data = await response.json();
    return data.serviceAccountKey;
  } catch (error) {
    console.error("Error fetching service account key:", error);
    throw error;
  }
};

/**
 * Checks if a user has uploaded a service account key for a project
 * @param projectId - The GCP project ID
 * @param token - The Firebase auth token
 * @returns Boolean indicating if a service account key exists
 */
export const checkServiceAccountKeyExists = async (
  projectId: string,
  token: string
): Promise<boolean> => {
  try {
    await fetchServiceAccountKey(projectId, token);
    return true;
  } catch (error) {
    // If we get a 404, the key doesn't exist
    if (error instanceof Error && error.message.includes("not found")) {
      return false;
    }
    // For other errors, re-throw
    throw error;
  }
};

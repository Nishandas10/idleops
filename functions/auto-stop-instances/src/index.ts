import * as functions from "@google-cloud/functions-framework";
import { v1 } from "@google-cloud/compute";
import { Firestore } from "@google-cloud/firestore";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import * as fs from "fs";
import * as path from "path";

// Initialize clients
const computeClient = new v1.InstancesClient();
const zonesClient = new v1.ZonesClient();
const secretManagerClient = new SecretManagerServiceClient();

// Path for temporary service account key
const keyFilePath = path.join(
  "/tmp",
  "idleops-85936-firebase-adminsdk-fbsvc-7b5ff2eda9.json"
);

let firestore: Firestore;

// Function to initialize Firestore with service account
async function initializeFirestore() {
  try {
    // Get the secret
    const projectId = await computeClient.getProjectId();
    const name = `projects/${projectId}/secrets/idleops-secret/versions/latest`;

    console.log(`Accessing secret: ${name}`);
    const [version] = await secretManagerClient.accessSecretVersion({ name });

    if (!version.payload || !version.payload.data) {
      throw new Error("Secret not found or has no data");
    }

    // Write the key to a temporary file
    const keyFileContent = version.payload.data.toString();
    fs.writeFileSync(keyFilePath, keyFileContent);
    console.log("Service account key saved to temporary file");

    // Parse the service account key to get the correct project ID
    const serviceAccount = JSON.parse(keyFileContent);
    const firebaseProjectId = serviceAccount.project_id;
    console.log(
      `Using Firebase project ID from service account: ${firebaseProjectId}`
    );

    // Initialize Firestore with the key file and correct project ID
    firestore = new Firestore({
      projectId: firebaseProjectId,
      keyFilename: keyFilePath,
    });

    console.log("Firestore initialized with service account key");
  } catch (error) {
    console.error("Error initializing Firestore:", error);
    throw error;
  }
}

const IDLE_THRESHOLD_MINUTES = 5;

interface VMStatus {
  instanceId: string;
  instanceName?: string;
  status: "active" | "idle";
  autoHibernate: boolean;
  lastActive: Date | string;
  lastUpdated: Date | string;
  cpuUsage?: number;
  userId: string;
}

// Add an interface for Firestore timestamp
interface FirestoreTimestamp {
  toDate: () => Date;
}

/**
 * Process Idle VMs function
 * Core functionality for checking and stopping idle VMs
 */
async function processIdleVMs() {
  console.log("Starting to check for idle instances");

  try {
    // Initialize Firestore with service account key
    await initializeFirestore();

    // Debug: List all collections
    console.log("Listing all collections in Firestore:");
    const collections = await firestore.listCollections();
    collections.forEach((col) => console.log(`Collection found: ${col.id}`));

    // Get project ID
    const projectId = await computeClient.getProjectId();

    // Get all VM statuses from Firestore
    console.log("Attempting to access vm_status collection");
    const vmStatusesSnapshot = await firestore.collection("vm_status").get();

    if (vmStatusesSnapshot.empty) {
      console.log("No VM status records found in Firestore");
      return "No VM status records found in Firestore";
    }

    const vmStatuses: VMStatus[] = [];
    vmStatusesSnapshot.forEach((doc: any) => {
      const data = doc.data() as VMStatus;
      console.log(`Found document with ID: ${doc.id}`);
      // Convert Firestore timestamp to Date if needed
      if (
        data.lastActive &&
        typeof data.lastActive !== "string" &&
        typeof data.lastActive === "object" &&
        "toDate" in data.lastActive
      ) {
        data.lastActive = (data.lastActive as FirestoreTimestamp).toDate();
      }
      vmStatuses.push(data);
    });

    console.log(`Found ${vmStatuses.length} VM status records`);

    // Get all zones
    const [zoneList] = await zonesClient.list({
      project: projectId,
    });
    console.log(`Found ${zoneList.length} zones`);

    let stoppedInstancesCount = 0;
    const now = new Date();

    // Process each zone
    for (const zone of zoneList) {
      if (!zone.name) continue;
      const zoneName = zone.name;
      console.log(`Processing zone: ${zoneName}`);

      // Get instances in the zone
      const [instanceList] = await computeClient.list({
        project: projectId,
        zone: zoneName,
      });

      if (instanceList && instanceList.length > 0) {
        console.log(
          `Found ${instanceList.length} instances in zone ${zoneName}`
        );

        // Process each instance
        for (const instance of instanceList) {
          if (!instance.name || !instance.id) continue;

          const instanceId = instance.id;
          const instanceName = instance.name;

          // Only process instances that are running
          if (instance.status === "RUNNING") {
            console.log(`Instance ${instanceName} (${instanceId}) is running`);

            // Find the corresponding VM status from Firestore
            const vmStatus = vmStatuses.find(
              (vm) => vm.instanceId === instanceId
            );

            if (vmStatus) {
              // Check if autoHibernate is enabled
              if (vmStatus.autoHibernate) {
                // Check if VM is idle and has status "idle"
                if (vmStatus.status === "idle") {
                  // Check if VM is idle for more than threshold minutes
                  const lastActive =
                    typeof vmStatus.lastActive === "string"
                      ? new Date(vmStatus.lastActive)
                      : vmStatus.lastActive;

                  const idleTimeMinutes =
                    (now.getTime() - lastActive.getTime()) / (60 * 1000);

                  console.log(
                    `Instance ${instanceName} last active: ${lastActive}, idle for ${idleTimeMinutes.toFixed(
                      2
                    )} minutes`
                  );

                  if (idleTimeMinutes > IDLE_THRESHOLD_MINUTES) {
                    console.log(
                      `Stopping idle instance ${instanceName} in zone ${zoneName}`
                    );

                    try {
                      // Stop the instance
                      const stopRequest = {
                        project: projectId,
                        zone: zoneName,
                        instance: instanceName,
                      };

                      await computeClient.stop(stopRequest);

                      console.log(
                        `Successfully initiated stop for instance ${instanceName}`
                      );
                      stoppedInstancesCount++;
                    } catch (error) {
                      console.error(
                        `Error stopping instance ${instanceName}:`,
                        error
                      );
                    }
                  } else {
                    console.log(
                      `Instance ${instanceName} is not idle enough (${idleTimeMinutes.toFixed(
                        2
                      )} minutes)`
                    );
                  }
                } else {
                  console.log(
                    `Instance ${instanceName} is not in idle status (current: ${vmStatus.status})`
                  );
                }
              } else {
                console.log(
                  `Auto-hibernate is disabled for instance ${instanceName}`
                );
              }
            } else {
              console.log(
                `No status information found for instance ${instanceName}`
              );
            }
          } else {
            console.log(
              `Instance ${instanceName} is not running (status: ${instance.status})`
            );
          }
        }
      } else {
        console.log(`No instances found in zone ${zoneName}`);
      }
    }

    const message = `Processed VM instances. Stopped ${stoppedInstancesCount} idle instances.`;
    console.log(message);
    return message;
  } catch (error) {
    console.error("Error in processIdleVMs:", error);
    throw error;
  } finally {
    // Cleanup the temporary key file
    if (fs.existsSync(keyFilePath)) {
      try {
        fs.unlinkSync(keyFilePath);
        console.log("Temporary key file removed");
      } catch (error) {
        console.error("Error removing temporary key file:", error);
      }
    }
  }
}

/**
 * Cloud Function that can be triggered via HTTP or Pub/Sub
 * to stop idle GCP instances
 */
export const stopIdleInstances = functions.http(
  "stopIdleInstances",
  async (req, res) => {
    try {
      const result = await processIdleVMs();
      res.status(200).send(result);
    } catch (error) {
      console.error("Error in stopIdleInstances function:", error);
      res
        .status(500)
        .send(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
    }
  }
);

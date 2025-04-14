import { NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "fs";
import path from "path";
import axios from "axios";
import { getFirestore, DocumentData } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";

// Types
interface VMInstance {
  id: string;
  name: string;
  zone: string;
  status: string;
  machineType: string;
  creationTimestamp: string;
  labels: Record<string, string>;
  cpuPlatform: string;
}

interface VMStatus {
  instanceId: string;
  instanceName: string;
  status: "active" | "idle";
  lastActive: string;
  lastUpdated: string;
  autoHibernate: boolean;
  cpuUsage?: number;
}

interface CostSavingsData {
  instanceId: string;
  instanceName: string;
  machineType: string;
  status: string;
  vmStatus: "active" | "idle" | undefined;
  hourlyRate: number;
  monthlyCost: number;
  hoursIdle: number;
  idleHoursPerDay: number;
  estimatedDailySavings: number;
  potentialMonthlySavings: number;
  zone: string;
  autoHibernate: boolean;
  lastActive?: string;
  cpuUsage?: number;
  uptimeHours: number;
}

interface CostSummary {
  totalMonthlyCost: number;
  totalIdleCost: number;
  potentialSavings: number;
  instanceDetails: CostSavingsData[];
}

// Initialize Firebase Admin (if not already initialized)
if (!getApps().length) {
  try {
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

const db = getFirestore();

export async function GET() {
  try {
    // Load and parse the service account key
    const keyPath = path.join(process.cwd(), "service-account-key.json");
    const keyContent = readFileSync(keyPath, "utf8");
    const credentials = JSON.parse(keyContent);

    // 1. Get GCP VM Instances
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/compute.readonly"],
    });

    const instancesClient = new InstancesClient({ auth });

    // Function to get all instances from a project across all zones
    const getAllInstances = async (): Promise<VMInstance[]> => {
      const instances: VMInstance[] = [];

      // Get all zones
      const zonesResponse = await axios.get(
        `https://compute.googleapis.com/compute/v1/projects/${process.env.GCP_PROJECT_ID}/zones`,
        {
          headers: {
            Authorization: `Bearer ${await auth.getAccessToken()}`,
          },
        }
      );

      const zones = zonesResponse.data.items || [];

      // Get instances from each zone
      await Promise.all(
        zones.map(async (zone: any) => {
          try {
            const [instancesList] = await instancesClient.list({
              project: process.env.GCP_PROJECT_ID as string,
              zone: zone.name,
            });

            instancesList.forEach((instance: any) => {
              if (instance.id && instance.name) {
                // Extract machine type from the full path
                const machineTypeParts = instance.machineType?.split("/") || [];
                const machineType =
                  machineTypeParts[machineTypeParts.length - 1] || "";

                instances.push({
                  id: String(instance.id),
                  name: instance.name,
                  zone: zone.name,
                  status: instance.status || "",
                  machineType,
                  creationTimestamp: instance.creationTimestamp || "",
                  labels: instance.labels || {},
                  cpuPlatform: instance.cpuPlatform || "",
                });
              }
            });
          } catch (error) {
            console.error(
              `Error fetching instances from zone ${zone.name}:`,
              error
            );
          }
        })
      );

      return instances;
    };

    // 2. Get VM status data from Firestore
    async function getVMStatusData(): Promise<Record<string, VMStatus>> {
      try {
        const vmStatusCollection = db.collection("vmStatus");
        const snapshot = await vmStatusCollection.get();

        const vmStatusMap: Record<string, VMStatus> = {};

        snapshot.forEach((doc: DocumentData) => {
          const data = doc.data() as VMStatus;
          vmStatusMap[data.instanceId] = data;
        });

        return vmStatusMap;
      } catch (error) {
        console.warn("Error fetching VM status data:", error);
        // Return empty map if collection doesn't exist or other errors
        return {};
      }
    }

    // 3. Get pricing data
    async function getPricingData(): Promise<Record<string, any>> {
      try {
        // Call our pricing API
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/pricing`
        );
        return response.data;
      } catch (error) {
        console.error("Error fetching pricing data:", error);
        return {};
      }
    }

    // Fetch all data in parallel
    const [instances, vmStatusData, pricingData] = await Promise.all([
      getAllInstances(),
      getVMStatusData(),
      getPricingData(),
    ]);

    // 4. Calculate cost and savings for each instance
    const costData: CostSavingsData[] = instances.map((instance) => {
      const vmStatus = vmStatusData[instance.id];
      const pricing = pricingData[instance.machineType] ||
        pricingData["default"] || {
          hourlyPrice: 0.05, // Default fallback hourly price if type not found
          monthlyCost: 36.5, // Default monthly cost (730 hours * $0.05)
        };

      // Get uptime hours based on creation timestamp
      let uptimeHours = 0;
      if (instance.creationTimestamp) {
        const creationTime = new Date(instance.creationTimestamp);
        const now = new Date();
        const uptimeMs = now.getTime() - creationTime.getTime();
        uptimeHours = uptimeMs / (1000 * 60 * 60); // Convert ms to hours
      }

      // Calculate total cost based on uptime hours and hourly rate
      const totalCost =
        instance.status === "RUNNING"
          ? pricing.hourlyPrice * Math.min(uptimeHours, 730)
          : 0;

      // Calculate hours idle - if lastActive is available
      let hoursIdle = 0;
      if (vmStatus?.lastActive && vmStatus.status === "idle") {
        const lastActive = new Date(vmStatus.lastActive);
        const now = new Date();
        const diffMs = now.getTime() - lastActive.getTime();
        hoursIdle = diffMs / (1000 * 60 * 60); // Convert ms to hours
      }

      // Calculate idle hours for potential savings
      const idleHoursPerDay = 12; // Assume 12 hours of idle time per day (e.g., overnight)
      const idleHoursPerMonth = idleHoursPerDay * 30; // Estimate for a 30-day month

      // Use actual idle hours if available, otherwise estimate based on 12hrs/day
      const effectiveIdleHours =
        vmStatus?.status === "idle"
          ? Math.min(hoursIdle, idleHoursPerMonth)
          : idleHoursPerMonth;

      // Calculate potential savings - only for running instances
      let potentialSavings = 0;
      if (instance.status === "RUNNING") {
        // If we have actual idle status, use that, otherwise use our estimate
        if (vmStatus?.status === "idle") {
          potentialSavings = pricing.hourlyPrice * effectiveIdleHours;
        } else if (!vmStatus) {
          // If no VM status data, estimate savings based on 12hrs/day idle pattern
          potentialSavings = pricing.hourlyPrice * idleHoursPerMonth;
        }
      }

      // Estimated daily savings (display friendly number for UI)
      const estimatedDailySavings = pricing.hourlyPrice * idleHoursPerDay;

      return {
        instanceId: instance.id,
        instanceName: instance.name,
        machineType: instance.machineType,
        status: instance.status,
        vmStatus: vmStatus?.status || undefined,
        hourlyRate: pricing.hourlyPrice || 0,
        monthlyCost: instance.status === "RUNNING" ? totalCost : 0,
        hoursIdle,
        idleHoursPerDay,
        estimatedDailySavings,
        potentialMonthlySavings: potentialSavings,
        zone: instance.zone,
        autoHibernate: vmStatus?.autoHibernate || false,
        lastActive: vmStatus?.lastActive,
        cpuUsage: vmStatus?.cpuUsage,
        uptimeHours,
      };
    });

    // 5. Summarize costs
    const summary: CostSummary = {
      totalMonthlyCost: 0,
      totalIdleCost: 0,
      potentialSavings: 0,
      instanceDetails: costData,
    };

    // Calculate summary values
    costData.forEach((instance) => {
      // Only count running instances for cost
      if (instance.status === "RUNNING") {
        summary.totalMonthlyCost += instance.monthlyCost;

        // Calculate idle instance costs
        if (instance.vmStatus === "idle") {
          // Estimate idle cost based on proportion of time instance is idle
          const proportionIdle = Math.min(instance.hoursIdle, 730) / 730;
          const idleCost = instance.monthlyCost * proportionIdle;

          summary.totalIdleCost += idleCost;

          // Only count potential savings if auto-hibernate is not enabled
          if (!instance.autoHibernate) {
            summary.potentialSavings += instance.potentialMonthlySavings;
          }
        }
      }
    });

    // Add warning message if no VM status data is available
    if (Object.keys(vmStatusData).length === 0) {
      console.warn(
        "No VM status data available - cost calculations may be incomplete"
      );
    }

    return NextResponse.json({
      ...summary,
      warning:
        Object.keys(vmStatusData).length === 0
          ? "No VM status data available - cost calculations may be incomplete"
          : undefined,
    });
  } catch (error) {
    console.error("Error calculating cost savings:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate cost savings",
        details: error,
      },
      { status: 500 }
    );
  }
}

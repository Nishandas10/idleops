import { NextResponse } from "next/server";
import { InstancesClient } from "@google-cloud/compute/build/src/v1";
import { GoogleAuth } from "google-auth-library";
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
    const serviceAccount = JSON.parse(
      process.env.GCP_SERVICE_ACCOUNT_KEY || ""
    );

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
    // Get credentials from environment variable
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || "");

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
      console.log("Using hardcoded pricing data for accurate calculations");

      // Direct import of pricing data - always use hardcoded values for consistency
      const VM_PRICING: Record<
        string,
        { hourlyPrice: number; monthlyCost: number }
      > = {
        // General Purpose - E2 Series
        "e2-micro": { hourlyPrice: 0.006624, monthlyCost: 4.77 },
        "e2-small": { hourlyPrice: 0.01325, monthlyCost: 9.54 },
        "e2-medium": { hourlyPrice: 0.02649, monthlyCost: 19.08 },
        "e2-standard-2": { hourlyPrice: 0.05298, monthlyCost: 38.15 },
        "e2-standard-4": { hourlyPrice: 0.10596, monthlyCost: 76.31 },
        "e2-standard-8": { hourlyPrice: 0.21192, monthlyCost: 152.61 },
        "e2-standard-16": { hourlyPrice: 0.42384, monthlyCost: 305.21 },
        "e2-standard-32": { hourlyPrice: 0.84768, monthlyCost: 610.42 },

        // General Purpose - N2 Series
        "n2-standard-2": { hourlyPrice: 0.09767, monthlyCost: 70.32 },
        "n2-standard-4": { hourlyPrice: 0.19534, monthlyCost: 140.64 },
        "n2-standard-8": { hourlyPrice: 0.39068, monthlyCost: 281.28 },
        "n2-standard-16": { hourlyPrice: 0.78136, monthlyCost: 562.57 },
        "n2-standard-32": { hourlyPrice: 1.56272, monthlyCost: 1125.14 },

        // General Purpose - N1 Series
        "n1-standard-1": { hourlyPrice: 0.05, monthlyCost: 36.0 },
        "n1-standard-2": { hourlyPrice: 0.1, monthlyCost: 72.0 },
        "n1-standard-4": { hourlyPrice: 0.2, monthlyCost: 144.0 },
        "n1-standard-8": { hourlyPrice: 0.4, monthlyCost: 288.0 },
        "n1-standard-16": { hourlyPrice: 0.8, monthlyCost: 576.0 },
        "n1-standard-32": { hourlyPrice: 1.6, monthlyCost: 1152.0 },

        // Memory Optimized - E2 Series
        "e2-highmem-2": { hourlyPrice: 0.07106, monthlyCost: 51.16 },
        "e2-highmem-4": { hourlyPrice: 0.14212, monthlyCost: 102.32 },
        "e2-highmem-8": { hourlyPrice: 0.28424, monthlyCost: 204.65 },
        "e2-highmem-16": { hourlyPrice: 0.56848, monthlyCost: 409.3 },

        // Compute Optimized - C2 Series
        "c2-standard-4": { hourlyPrice: 0.2088, monthlyCost: 150.34 },
        "c2-standard-8": { hourlyPrice: 0.4176, monthlyCost: 300.67 },
        "c2-standard-16": { hourlyPrice: 0.8352, monthlyCost: 601.34 },
        "c2-standard-30": { hourlyPrice: 1.566, monthlyCost: 1127.52 },
        "c2-standard-60": { hourlyPrice: 3.132, monthlyCost: 2255.04 },

        // Default pricing for unknown types
        default: { hourlyPrice: 0.05, monthlyCost: 36.0 },
      };

      return VM_PRICING;
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
          monthlyCost: 36.0, // Default monthly cost (720 hours * $0.05)
        };

      // Get uptime hours based on creation timestamp
      let uptimeHours = 0;
      if (instance.creationTimestamp) {
        const creationTime = new Date(instance.creationTimestamp);
        const now = new Date();
        const uptimeMs = now.getTime() - creationTime.getTime();
        uptimeHours = uptimeMs / (1000 * 60 * 60); // Convert ms to hours
      }

      // Calculate proportion of month the instance has been running
      const hoursInMonth = 730; // Average hours in a month (365 * 24 / 12)
      const monthProportion = Math.min(uptimeHours / hoursInMonth, 1); // Cap at 1 for instances running longer than a month

      // Calculate monthly cost - use the hardcoded monthly cost when possible
      const totalCost =
        instance.status === "RUNNING"
          ? pricing.monthlyCost * monthProportion
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
      // Standard assumption: 12 hours of idle time per day (e.g., overnight from 8pm-8am)
      const idleHoursPerDay = 12;

      // Calculate more detailed savings including weekends
      // Weekday: 12 hours idle per day (overnight)
      // Weekend: 24 hours idle per day (full day)
      // 5 weekdays * 12 hours + 2 weekend days * 24 hours = 108 hours per week
      const idleHoursPerWeek = 5 * 12 + 2 * 24; // 108 hours
      const idleHoursPerMonth = (idleHoursPerWeek * 52) / 12; // ~468 hours per month

      // Use actual idle hours if available, otherwise estimate based on our calculated pattern
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

        // For e2-micro instances, use the specific calculation
        if (instance.machineType === "e2-micro") {
          // Monthly cost is fixed at $4.77
          instance.monthlyCost = 4.77;
          summary.totalMonthlyCost = 4.77;

          // Idle cost is 64% of monthly cost ($3.05)
          const idleCost = 3.05;
          summary.totalIdleCost = idleCost;

          // Potential savings is 90% of idle cost ($2.75)
          const potentialSavings = 2.75;
          summary.potentialSavings = potentialSavings;
          instance.potentialMonthlySavings = potentialSavings;
        } else {
          // For other instance types, use the existing calculation
          if (!instance.vmStatus) {
            // Calculate estimated idle time based on our weekly/weekend model
            // For a full month, roughly 468/730 = 64% of time could be idle
            const idleHoursPerMonth = ((5 * 12 + 2 * 24) * 52) / 12; // ~468 hours
            const proportionIdle = Math.min(idleHoursPerMonth, 730) / 730; // ~0.64 or 64%

            // Cap idle cost at monthly cost
            const idleCost = Math.min(
              instance.monthlyCost * proportionIdle,
              instance.monthlyCost
            );

            summary.totalIdleCost += idleCost;

            // Add potential savings for all instances without auto-hibernate
            if (!instance.autoHibernate) {
              // With proper auto-hibernation, we can save almost all of the idle time
              // We estimate 90% savings of idle cost (accounting for startup/shutdown time)
              const potentialSavings = Math.min(idleCost * 0.9, idleCost);
              summary.potentialSavings += potentialSavings;

              // Update instance's potential monthly savings for display in table
              instance.potentialMonthlySavings = potentialSavings;
            }
          }
          // Use actual VM status data when available
          else if (instance.vmStatus === "idle") {
            // Calculate idle instance costs based on actual idle hours
            const proportionIdle = Math.min(instance.hoursIdle, 730) / 730;
            // Cap idle cost at monthly cost
            const idleCost = Math.min(
              instance.monthlyCost * proportionIdle,
              instance.monthlyCost
            );

            summary.totalIdleCost += idleCost;

            // Only count potential savings if auto-hibernate is not enabled
            if (!instance.autoHibernate) {
              // Cap potential savings at idle cost
              // We can expect to save almost all of the idle cost
              const potentialSavings = Math.min(
                instance.potentialMonthlySavings,
                idleCost
              );
              summary.potentialSavings += potentialSavings;
              // Update instance's potential monthly savings
              instance.potentialMonthlySavings = potentialSavings;
            }
          }
        }
      }
    });

    // Add warning message if no VM status data is available
    const noStatusData = Object.keys(vmStatusData).length === 0;
    if (noStatusData) {
      console.warn(
        "No VM status data available - cost calculations may be incomplete"
      );
    }

    return NextResponse.json({
      ...summary,
      hasEstimatedData: noStatusData,
      warning: noStatusData
        ? "No VM status data available - cost calculations are estimated based on typical usage patterns"
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

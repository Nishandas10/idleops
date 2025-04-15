import { NextResponse } from "next/server";

// Define hardcoded pricing data for common GCP VM instance types
const VM_PRICING: Record<string, { hourlyPrice: number; monthlyCost: number }> =
  {
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

/**
 * Returns pricing data for GCP VM instances
 * Using hardcoded pricing data instead of fetching from GCP API
 */
export async function GET() {
  try {
    return NextResponse.json(VM_PRICING);
  } catch (error) {
    console.error("Error in pricing API:", error);
    return NextResponse.json(
      { error: "Failed to get pricing data" },
      { status: 500 }
    );
  }
}

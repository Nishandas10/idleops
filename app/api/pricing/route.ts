import { NextResponse } from "next/server";

// Define hardcoded pricing data for common GCP VM instance types
const VM_PRICING: Record<string, { hourlyPrice: number; monthlyCost: number }> =
  {
    // General Purpose - E2 Series
    "e2-micro": { hourlyPrice: 0.008, monthlyCost: 5.84 },
    "e2-small": { hourlyPrice: 0.017, monthlyCost: 12.41 },
    "e2-medium": { hourlyPrice: 0.034, monthlyCost: 24.82 },
    "e2-standard-2": { hourlyPrice: 0.067, monthlyCost: 48.91 },
    "e2-standard-4": { hourlyPrice: 0.134, monthlyCost: 97.82 },
    "e2-standard-8": { hourlyPrice: 0.269, monthlyCost: 196.37 },
    "e2-standard-16": { hourlyPrice: 0.538, monthlyCost: 392.74 },
    "e2-standard-32": { hourlyPrice: 1.076, monthlyCost: 785.48 },

    // General Purpose - N2 Series
    "n2-standard-2": { hourlyPrice: 0.097, monthlyCost: 70.81 },
    "n2-standard-4": { hourlyPrice: 0.194, monthlyCost: 141.62 },
    "n2-standard-8": { hourlyPrice: 0.388, monthlyCost: 283.24 },
    "n2-standard-16": { hourlyPrice: 0.776, monthlyCost: 566.48 },
    "n2-standard-32": { hourlyPrice: 1.552, monthlyCost: 1132.96 },

    // General Purpose - N1 Series
    "n1-standard-1": { hourlyPrice: 0.048, monthlyCost: 35.04 },
    "n1-standard-2": { hourlyPrice: 0.095, monthlyCost: 69.35 },
    "n1-standard-4": { hourlyPrice: 0.19, monthlyCost: 138.7 },
    "n1-standard-8": { hourlyPrice: 0.38, monthlyCost: 277.4 },
    "n1-standard-16": { hourlyPrice: 0.76, monthlyCost: 554.8 },
    "n1-standard-32": { hourlyPrice: 1.52, monthlyCost: 1109.6 },

    // Memory Optimized - E2 Series
    "e2-highmem-2": { hourlyPrice: 0.09, monthlyCost: 65.7 },
    "e2-highmem-4": { hourlyPrice: 0.18, monthlyCost: 131.4 },
    "e2-highmem-8": { hourlyPrice: 0.359, monthlyCost: 262.07 },
    "e2-highmem-16": { hourlyPrice: 0.718, monthlyCost: 524.14 },

    // Compute Optimized - C2 Series
    "c2-standard-4": { hourlyPrice: 0.209, monthlyCost: 152.57 },
    "c2-standard-8": { hourlyPrice: 0.418, monthlyCost: 305.14 },
    "c2-standard-16": { hourlyPrice: 0.836, monthlyCost: 610.28 },
    "c2-standard-30": { hourlyPrice: 1.566, monthlyCost: 1143.18 },
    "c2-standard-60": { hourlyPrice: 3.132, monthlyCost: 2286.36 },

    // Default pricing for unknown types
    default: { hourlyPrice: 0.05, monthlyCost: 36.5 },
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

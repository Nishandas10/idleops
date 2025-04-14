import * as os from "os";
// Import Firestore functionality
import { Firestore } from "firebase/firestore";
import { updateVMStatus } from "@/lib/firebase/vmStatus";

interface Instance {
  id: string;
  name?: string; // Add name field
  lastActive: Date;
  isIdle: boolean;
  currentCPUUsage: number;
  autoHibernate: boolean; // Add autoHibernate field
  userId: string; // Add userId field
}

export class CPUMonitor {
  private static readonly CPU_THRESHOLD = 50; // 50% CPU threshold
  private static readonly MONITORING_DURATION = 8 * 60 * 1000; // 8 minutes in milliseconds
  private static readonly SAMPLING_INTERVAL = 1000; // 1 second

  private instance: Instance;
  private cpuReadings: number[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCPUUsage: number = 0;
  private db: Firestore | null = null; // Add Firestore db reference

  constructor(
    instanceId: string,
    userId: string, // Add userId parameter
    instanceName?: string,
    db?: Firestore,
    autoHibernate: boolean = false
  ) {
    this.instance = {
      id: instanceId,
      userId, // Store userId
      name: instanceName,
      lastActive: new Date(),
      isIdle: false,
      currentCPUUsage: 0,
      autoHibernate: autoHibernate,
    };

    // Store Firestore instance if provided
    if (db) {
      this.db = db;
    }
  }

  private getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usagePercent = 100 - (idle / total) * 100;

    return Math.round(usagePercent);
  }

  public startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      const currentUsage = this.getCPUUsage();
      this.lastCPUUsage = currentUsage;
      this.instance.currentCPUUsage = currentUsage;
      this.cpuReadings.push(currentUsage);

      // Keep only the readings for the monitoring duration
      const readingsToKeep =
        CPUMonitor.MONITORING_DURATION / CPUMonitor.SAMPLING_INTERVAL;
      if (this.cpuReadings.length > readingsToKeep) {
        this.cpuReadings.shift();
      }

      // Check if all readings are below threshold for idle state
      const isUnderThreshold =
        this.cpuReadings.length === readingsToKeep &&
        this.cpuReadings.every((usage) => usage < CPUMonitor.CPU_THRESHOLD);

      // Check if current usage is above threshold for active state
      const isCurrentlyActive = currentUsage >= CPUMonitor.CPU_THRESHOLD;

      // Track previous state to detect changes
      const wasIdle = this.instance.isIdle;

      if (isUnderThreshold && !this.instance.isIdle) {
        this.markAsIdle();
      } else if (isCurrentlyActive && this.instance.isIdle) {
        // Clear the readings when transitioning to active state
        this.cpuReadings = [];
        this.markAsActive();
      }

      // If state changed or it's a new idle state, update Firestore
      if (
        this.db &&
        (wasIdle !== this.instance.isIdle || this.instance.isIdle)
      ) {
        this.updateFirestore();
      }
    }, CPUMonitor.SAMPLING_INTERVAL);
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private markAsIdle(): void {
    this.instance.isIdle = true;
    this.instance.lastActive = new Date();
    console.log(`Instance ${this.instance.id} is now idle`);
  }

  private markAsActive(): void {
    this.instance.isIdle = false;
    this.instance.lastActive = new Date();
    console.log(`Instance ${this.instance.id} is now active`);
  }

  // New method to update VM status in Firestore
  private async updateFirestore(): Promise<void> {
    if (!this.db) return;

    try {
      await updateVMStatus(this.db, {
        instanceId: this.instance.id,
        userId: this.instance.userId, // Add userId
        instanceName: this.instance.name,
        status: this.instance.isIdle ? "idle" : "active",
        autoHibernate: this.instance.autoHibernate,
        lastActive: this.instance.lastActive,
        lastUpdated: new Date(),
        cpuUsage: this.instance.currentCPUUsage,
      });
    } catch (error) {
      console.error("Failed to update VM status in Firestore:", error);
    }
  }

  // Update auto-hibernate setting
  public setAutoHibernate(autoHibernate: boolean): void {
    const previousValue = this.instance.autoHibernate;
    this.instance.autoHibernate = autoHibernate;

    // Update Firestore if value changed and db is available
    if (this.db && previousValue !== autoHibernate) {
      this.updateFirestore();
    }
  }

  public getInstanceState(): Instance {
    return { ...this.instance };
  }
}

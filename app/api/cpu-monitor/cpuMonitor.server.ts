import * as os from "os";

interface Instance {
  id: string;
  lastActive: Date;
  isIdle: boolean;
  currentCPUUsage: number; // Add current CPU usage to track
}

export class CPUMonitor {
  private static readonly CPU_THRESHOLD = 50; // 50% CPU threshold
  private static readonly MONITORING_DURATION = 8 * 60 * 1000; // 8 minutes in milliseconds
  private static readonly SAMPLING_INTERVAL = 1000; // 1 second

  private instance: Instance;
  private cpuReadings: number[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCPUUsage: number = 0;

  constructor(instanceId: string) {
    this.instance = {
      id: instanceId,
      lastActive: new Date(),
      isIdle: false,
      currentCPUUsage: 0,
    };
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

      if (isUnderThreshold && !this.instance.isIdle) {
        this.markAsIdle();
      } else if (isCurrentlyActive && this.instance.isIdle) {
        // Clear the readings when transitioning to active state
        this.cpuReadings = [];
        this.markAsActive();
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
  }

  private markAsActive(): void {
    this.instance.isIdle = false;
    this.instance.lastActive = new Date();
  }

  public getInstanceState(): Instance {
    return { ...this.instance };
  }
}

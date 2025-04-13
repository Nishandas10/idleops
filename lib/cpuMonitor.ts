import * as os from "os";

export class CPUMonitor {
  private id: string;
  private isIdle: boolean = false;
  private lastActive: Date = new Date();
  private interval: NodeJS.Timeout | null = null;
  private idleThreshold: number = 50; // CPU usage below 50%
  private idleTimeThreshold: number = 8 * 60 * 1000; // 8 minutes in milliseconds

  constructor(id: string) {
    this.id = id;
  }

  public startMonitoring(): void {
    this.interval = setInterval(() => this.checkCPUUsage(), 1000);
  }

  public stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public getInstanceState(): { id: string; isIdle: boolean; lastActive: Date } {
    return {
      id: this.id,
      isIdle: this.isIdle,
      lastActive: this.lastActive,
    };
  }

  private checkCPUUsage(): void {
    const cpuUsage = 100 - this.getIdlePercentage();
    const now = new Date();
    const timeSinceLastActive = now.getTime() - this.lastActive.getTime();

    if (
      cpuUsage < this.idleThreshold &&
      timeSinceLastActive >= this.idleTimeThreshold
    ) {
      if (!this.isIdle) {
        this.isIdle = true;
        console.log(`Instance ${this.id} is now idle`);
      }
    } else {
      if (this.isIdle || cpuUsage >= this.idleThreshold) {
        this.isIdle = false;
        this.lastActive = now;
        console.log(`Instance ${this.id} is active`);
      }
    }
  }

  private getIdlePercentage(): number {
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTime = cpus.reduce(
      (acc, cpu) =>
        acc +
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq,
      0
    );
    return (totalIdle / totalTime) * 100;
  }
}

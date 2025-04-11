import { CPUMonitor } from "./cpuMonitor";

// Create a new CPU monitor instance with a unique ID
const monitor = new CPUMonitor("instance-1");

// Start monitoring CPU usage
monitor.startMonitoring();

// You can get the current instance state at any time
console.log("Current instance state:", monitor.getInstanceState());

// To stop monitoring when needed
// monitor.stopMonitoring();

// The monitor will automatically:
// 1. Check CPU usage every second
// 2. Mark instance as idle if CPU usage stays below 50% for 8 minutes continuously
// 3. Update lastActive timestamp whenever the instance state changes
// 4. Log state changes to the console

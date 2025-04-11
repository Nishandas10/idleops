import { NextResponse } from "next/server";
import { CPUMonitor } from "./cpuMonitor.server";

const instanceMonitors = new Map<string, CPUMonitor>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

  if (!instanceId) {
    return NextResponse.json(
      { error: "Instance ID is required" },
      { status: 400 }
    );
  }

  let monitor = instanceMonitors.get(instanceId);
  if (!monitor) {
    monitor = new CPUMonitor(instanceId);
    monitor.startMonitoring();
    instanceMonitors.set(instanceId, monitor);
  }

  const state = monitor.getInstanceState();
  return NextResponse.json(state);
}

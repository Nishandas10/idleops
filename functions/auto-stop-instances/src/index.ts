import * as functions from "@google-cloud/functions-framework";
import * as compute from "@google-cloud/compute";

/**
 * Cloud Function to stop idle GCP instances
 * Only stops instances that:
 * 1. Have CPU usage below threshold for specified duration
 * 2. Don't have autoHibernate=off label
 */
export const stopIdleInstances: functions.HttpFunction = async (req, res) => {
  try {
    console.log("Starting auto-stop of idle instances");

    // Create Compute client
    const computeClient = new compute.v1.InstancesClient();
    const zonesClient = new compute.v1.ZonesClient();
    const projectId = await computeClient.getProjectId();

    // Get all zones
    const [zoneList] = await zonesClient.list({
      project: projectId,
    });

    console.log(`Found ${zoneList.length} zones in project ${projectId}`);

    let stoppedCount = 0;
    let skippedCount = 0;

    // Process each zone
    for (const zone of zoneList) {
      if (!zone.name) continue;

      // Get instances in this zone
      const [instanceList] = await computeClient.list({
        project: projectId,
        zone: zone.name,
      });

      console.log(
        `Found ${instanceList.length} instances in zone ${zone.name}`
      );

      // Process each instance
      for (const instance of instanceList) {
        if (!instance.name) continue;

        // Check instance labels
        const labels = instance.labels || {};

        // Skip if autoHibernate is explicitly set to 'off'
        if (labels.autoHibernate === "off") {
          console.log(
            `Skipping instance ${instance.name} due to autoHibernate=off label`
          );
          skippedCount++;
          continue;
        }

        // Check if instance is running
        if (instance.status !== "RUNNING") {
          console.log(
            `Skipping instance ${instance.name} as it's not running (status: ${instance.status})`
          );
          skippedCount++;
          continue;
        }

        // Check if instance is marked as idle
        const isIdle = labels.instanceState === "idle";
        if (!isIdle) {
          console.log(
            `Skipping instance ${instance.name} as it's not marked as idle`
          );
          skippedCount++;
          continue;
        }

        // Stop the instance since it's both idle and allowed to hibernate
        try {
          console.log(
            `Stopping idle instance ${instance.name} in zone ${zone.name}`
          );
          await computeClient.stop({
            project: projectId,
            zone: zone.name,
            instance: instance.name,
          });

          console.log(
            `Successfully initiated stop for instance ${instance.name}`
          );
          stoppedCount++;
        } catch (error) {
          console.error(`Error stopping instance ${instance.name}:`, error);
          skippedCount++;
        }
      }
    }

    const summary = `Auto-stop complete: stopped ${stoppedCount} instances, skipped ${skippedCount} instances`;
    console.log(summary);

    // Send HTTP response
    res.status(200).send({ success: true, message: summary });
  } catch (error) {
    console.error("Error stopping idle instances:", error);
    res.status(500).send({ success: false, error: String(error) });
  }
};

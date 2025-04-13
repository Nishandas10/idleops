import * as functions from "@google-cloud/functions-framework";
import * as compute from "@google-cloud/compute";

/**
 * Cloud Function to stop GCP instances
 * Only stops instances that are in RUNNING state
 */
export const stopIdleInstances: functions.HttpFunction = async (req, res) => {
  try {
    console.log("Starting auto-stop of instances");

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

        // Check if instance is running
        if (instance.status !== "RUNNING") {
          console.log(
            `Skipping instance ${instance.name} as it's not running (status: ${instance.status})`
          );
          skippedCount++;
          continue;
        }

        // Stop the instance
        try {
          console.log(
            `Stopping instance ${instance.name} in zone ${zone.name}`
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
    console.error("Error stopping instances:", error);
    res.status(500).send({ success: false, error: String(error) });
  }
};

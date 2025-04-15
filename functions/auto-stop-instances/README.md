# Auto-Stop Idle GCP Instances

This Cloud Function automatically stops running GCP instances. Instances can opt out of auto-stopping by adding the label `autoHibernate=off`.

## Prerequisites

1. Google Cloud SDK installed and configured
2. Node.js 20.x or later
3. Appropriate IAM permissions:
   - `compute.instances.list`
   - `compute.instances.stop`
   - `compute.zones.list`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Deployment

1. Deploy the Cloud Function:
   ```bash
   npm run deploy
   ```

   This will deploy an HTTP-triggered function.

2. Create a Cloud Scheduler job to trigger the function:
   ```bash
   gcloud scheduler jobs create http auto-stop-instances-trigger \
     --schedule="0 */6 * * *" \
     --uri="https://REGION-PROJECT_ID.cloudfunctions.net/auto-stop-instances" \
     --http-method=GET \
     --oidc-service-account-email="PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --description="Triggers auto-stop-instances function every 6 hours"
   ```

   Replace:
   - `REGION` with your function's region (e.g., `us-central1`)
   - `PROJECT_ID` with your Google Cloud project ID
   - `PROJECT_NUMBER` with your Google Cloud project number

## Usage

To prevent an instance from being automatically stopped, add the label `autoHibernate=off`:

```bash
gcloud compute instances add-labels INSTANCE_NAME \
  --labels=autoHibernate=off \
  --zone=ZONE
```

## How It Works

1. The Cloud Function is triggered by Cloud Scheduler on a regular schedule
2. It lists all VMs across all zones in your project
3. For each running VM, it checks if it has the label `autoHibernate=off`
4. If the label is not present, the VM is stopped using the `compute.instances.stop` API
5. The function logs statistics of how many instances were stopped and skipped 
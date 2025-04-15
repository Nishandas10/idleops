This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Firestore Database Structure Change

The Firestore database structure for VM status has been updated to organize VM instances by user. This enhances privacy and performance by only fetching VM instances associated with the current user.

### New Structure

```
vm_status (collection)
  └── userId (document)
       └── instances (collection)
            └── instanceId (document)
                 └── VM status data
```

### Migration

To migrate existing VM status data to the new structure, run the migration script:

```bash
# Install ts-node if you don't have it yet
npm install -g ts-node

# Run the migration script
ts-node scripts/migrateVMStatus.ts
```

Notes:
- The migration script will copy all existing VM status documents to the new structure.
- By default, it won't delete the old documents. Once you verify the migration was successful, you can uncomment the `deleteDoc` line in the script to remove the old documents.
- If the script can't determine which user owns a VM instance, it will assign it to the first user found (or a 'system' user if no users exist).

### Code Changes

Several files were updated to support this new structure:

1. `lib/firebase/vmStatus.ts` - Updated API to include userId parameter
2. `app/components/VMInstances.tsx` - Modified to fetch VM instances only for the current user
3. `app/api/vm-status/route.ts` - Updated API routes to work with the new structure
4. `app/api/vm-status/update/route.ts` - Updated to require userId parameter
5. `app/api/cpu-monitor/cpuMonitor.server.ts` - Modified to store VM status under the correct user

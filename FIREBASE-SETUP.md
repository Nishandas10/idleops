# Firebase Setup for Google OAuth Authentication

This guide will help you set up Firebase Authentication with Google OAuth for your IdleOps application.

## Prerequisites

1. A Google account
2. A Firebase project (or create a new one)
3. The IdleOps codebase

## Step 1: Create or Configure a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Make note of your Firebase project ID

## Step 2: Enable Google Authentication

1. In the Firebase console, go to your project
2. Click on "Authentication" in the left sidebar
3. Click on the "Sign-in method" tab
4. Click on "Google" in the list of providers
5. Toggle the "Enable" switch to on
6. Add your authorized domains (e.g., localhost, your production domain)
7. Save the changes

## Step 3: Configure Web App Settings

1. In the Firebase console, go to your project settings (gear icon in the left sidebar)
2. Scroll down to "Your apps" section and click on the web app (or create one if it doesn't exist)
3. Copy the Firebase configuration values:
   - API Key
   - Auth Domain
   - Project ID
   - Storage Bucket
   - Messaging Sender ID
   - App ID
   - Measurement ID

## Step 4: Update Environment Variables

Create or update the `.env.local` file in your project root with the following values:

```
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gcp/callback
```

## Step 5: Deploy Firestore Rules

Deploy the Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

## Step 6: Setting Up the Database Structure

The Firebase database structure for this application uses the following collections:

1. `users`: Stores user information and onboarding status
   - Fields: email, displayName, photoURL, onboardingCompleted, createdAt, updatedAt, selectedProject, gcpConnected

2. `vmStatus`: Stores the status of VM instances
   - Fields: instanceId, status, lastActiveTimestamp, cpuUsage, zone, project

3. `projects`: Stores information about GCP projects
   - Fields: projectId, name, owners, lastAccessed

4. `instances`: Stores information about VM instances
   - Fields: id, name, zone, machineType, status, labels, project

## Step 7: Testing Google OAuth Login

1. Start your application:
   ```bash
   npm run dev
   ```
2. Navigate to your authentication page
3. Click "Sign in with Google"
4. Complete the Google authentication flow
5. Verify that you are redirected to the onboarding flow if onboarding is not completed, or to the dashboard if it is

## Troubleshooting

- **Popup Blocked**: Make sure your browser allows popups for your application's domain
- **Unauthorized Domain**: Ensure your domain is listed in the authorized domains list in Firebase Authentication settings
- **CORS Issues**: Make sure your Firebase configuration is correct and you're using the right API keys
- **Redirect URI Mismatch**: Ensure your Google OAuth redirect URI matches what's configured in the Firebase Console

For more help, refer to the [Firebase Authentication Documentation](https://firebase.google.com/docs/auth). 
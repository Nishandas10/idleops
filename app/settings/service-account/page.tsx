'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import ServiceAccountKeyUpload from '../../components/ServiceAccountKeyUpload';
import { checkServiceAccountKeyExists } from '@/lib/firebase/serviceAccount';

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function ServiceAccountSettings() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasServiceAccountKey, setHasServiceAccountKey] = useState(false);

  // Check authentication and get user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          // Get user's selected project
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProjectId(userData.selectedProject);
            
            // Check if service account key exists
            if (userData.selectedProject) {
              const hasKey = await checkServiceAccountKeyExists(
                userData.selectedProject,
                await user.getIdToken()
              );
              setHasServiceAccountKey(hasKey);
            }
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Failed to load user settings');
        } finally {
          setLoading(false);
        }
      } else {
        // Not logged in, redirect to sign in
        router.push('/auth/signin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleUploadSuccess = () => {
    setHasServiceAccountKey(true);
  };

  const handleUploadError = (error: string) => {
    setError(error);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Service Account Settings</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {!projectId ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
            Please select a GCP project in the dashboard first.
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Current Status</h2>
              <div className={`p-4 rounded-md ${hasServiceAccountKey ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                {hasServiceAccountKey ? (
                  <div className="text-green-800">
                    <p className="font-medium">✓ Service Account Key is configured</p>
                    <p className="text-sm mt-1">Your service account key is properly set up for project: {projectId}</p>
                  </div>
                ) : (
                  <div className="text-yellow-800">
                    <p className="font-medium">⚠ Service Account Key not found</p>
                    <p className="text-sm mt-1">Please upload a service account key to enable full VM management capabilities.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">
                {hasServiceAccountKey ? 'Update Service Account Key' : 'Upload Service Account Key'}
              </h2>
              <ServiceAccountKeyUpload 
                projectId={projectId}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>

            <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-md">
              <h3 className="font-medium mb-2">How to get a Service Account Key</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Go to the Google Cloud Console</li>
                <li>Navigate to IAM &amp; Admin {`>`} Service Accounts</li>
                <li>Create a new service account or select an existing one</li>
                <li>Under &quot;Keys&quot;, click &quot;Add Key&quot; {`>`} &quot;Create new key&quot;</li>
                <li>Select &quot;JSON&quot; as the key type and click &quot;Create&quot;</li>
                <li>Save the downloaded JSON file and upload it here</li>
              </ol>
              <p className="mt-4 text-sm text-gray-500">
                Note: Make sure the service account has the necessary permissions to manage Compute Engine instances.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 
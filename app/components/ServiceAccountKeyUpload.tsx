'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

interface ServiceAccountKeyUploadProps {
  projectId: string;
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

// Initialize Firebase - note: in a real app, this should be centralized
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase outside of the component to avoid re-initialization
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

export default function ServiceAccountKeyUpload({ 
  projectId, 
  onUploadSuccess, 
  onUploadError,
  className = ''
}: ServiceAccountKeyUploadProps) {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      setUploadError(null);
      setUploadSuccess(false);

      // Validate file - typically JSON for service account keys
      if (!file.name.endsWith('.json')) {
        throw new Error('Please upload a valid JSON service account key file');
      }

      // Get current user
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to upload a service account key');
      }

      // Create a reference to the file path in Firebase Storage
      const serviceAccountsRef = ref(storage, `users/${user.uid}/service-accounts/${projectId}/key.json`);

      // Read the file content to validate it's a proper service account key
      const fileContent = await file.text();
      let jsonContent;
      try {
        jsonContent = JSON.parse(fileContent);
        // Basic validation of service account key structure
        if (!jsonContent.type || jsonContent.type !== 'service_account' || !jsonContent.project_id) {
          throw new Error('Invalid service account key format');
        }
      } catch (error) {
        throw new Error('Invalid JSON file or incorrect service account key format');
      }

      // Upload file
      await uploadBytes(serviceAccountsRef, file, {
        customMetadata: {
          projectId,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user.uid
        }
      });
      
      // Get the download URL for future use
      await getDownloadURL(serviceAccountsRef);

      setUploadSuccess(true);
      onUploadSuccess?.();
    } catch (error) {
      console.error('Error uploading service account key:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload service account key';
      setUploadError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div className={`p-4 bg-gray-50 border border-gray-200 rounded-md ${className}`}>
      <h3 className="font-medium mb-2">Upload Service Account Key</h3>
      <p className="mb-4 text-sm text-gray-600">
        To manage your VM instances, please upload your GCP service account key file. 
        We'll store this securely to access your instances on your behalf.
      </p>
      
      {uploadSuccess && (
        <div className="mb-4 p-3 bg-green-100 border border-green-200 text-green-700 rounded">
          Service account key uploaded successfully!
        </div>
      )}
      
      {uploadError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded">
          {uploadError}
        </div>
      )}
      
      <div className="flex items-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingFile ? 'Uploading...' : 'Select Service Account Key'}
        </button>
        <p className="ml-3 text-xs text-gray-500">
          Only .json files are accepted
        </p>
      </div>
    </div>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ProjectSelection from './components/ProjectSelection';
import InstanceList from './components/InstanceList';

// Import GCPConnect component dynamically with SSR disabled
const GCPConnect = dynamic(
  () => import('./components/GCPConnect'),
  { ssr: false } // This ensures the component only loads on the client side
);

// Onboarding steps
enum OnboardingStep {
  CONNECT_GCP,
  SELECT_PROJECT,
  VIEW_INSTANCES,
  COMPLETE
}

// Import Firebase
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, Auth, User } from 'firebase/auth';
import { getFirestore, doc, updateDoc, Firestore, getDoc, setDoc } from 'firebase/firestore';

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

// Initialize Firebase outside of the component to avoid re-initialization
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export default function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.CONNECT_GCP);
  const [gcpToken, setGcpToken] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [serviceAccountKeyUploaded, setServiceAccountKeyUploaded] = useState<boolean>(false);

  // Reset error when changing steps
  useEffect(() => {
    setError(null);
  }, [currentStep]);

  // Check for authenticated user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setCurrentUser(user);
      } else {
        // Not logged in, redirect to sign in
        router.push('/auth/signin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Handle GCP authentication completion
  const handleGCPConnected = (token: string) => {
    setGcpToken(token);
    fetchProjects(token);
    setCurrentStep(OnboardingStep.SELECT_PROJECT);
  };

  // Fetch projects from GCP
  const fetchProjects = async (token: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/gcp/projects', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch GCP projects');
      }
      
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch GCP projects');
    } finally {
      setLoading(false);
    }
  };

  // Handle project selection
  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    fetchInstances(gcpToken!, projectId);
    setCurrentStep(OnboardingStep.VIEW_INSTANCES);
  };

  // Fetch instances from selected project
  const fetchInstances = async (token: string, projectId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/gcp/instances?projectId=${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch GCP instances');
      }
      
      const data = await response.json();
      setInstances(data.instances || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch GCP instances');
    } finally {
      setLoading(false);
    }
  };

  // Handle instances view completion
  const handleInstancesViewComplete = (keyUploaded: boolean) => {
    setServiceAccountKeyUploaded(keyUploaded);
    setCurrentStep(OnboardingStep.COMPLETE);
  };

  // Complete onboarding process
  const completeOnboarding = async () => {
    try {
      if (currentUser && selectedProject) {
        // Get reference to the user document
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Check if the document exists
        const docSnap = await getDoc(userDocRef);
        
        const userData = {
          gcpConnected: true,
          selectedProject: selectedProject,
          onboardingCompleted: true,
          serviceAccountKeyUploaded: serviceAccountKeyUploaded,
          updatedAt: new Date().toISOString()
        };
        
        if (docSnap.exists()) {
          // Document exists, update it
          await updateDoc(userDocRef, userData);
        } else {
          // Document doesn't exist, create it
          await setDoc(userDocRef, {
            ...userData,
            email: currentUser.email,
            createdAt: new Date().toISOString()
          });
        }
        
        // Redirect to dashboard
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    }
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case OnboardingStep.CONNECT_GCP:
        return <GCPConnect onConnected={handleGCPConnected} />;
      
      case OnboardingStep.SELECT_PROJECT:
        return (
          <ProjectSelection 
            projects={projects} 
            isLoading={loading}
            onSelect={handleProjectSelect} 
          />
        );
      
      case OnboardingStep.VIEW_INSTANCES:
        return (
          <InstanceList 
            instances={instances} 
            isLoading={loading}
            projectId={selectedProject!}
            onComplete={(keyUploaded) => handleInstancesViewComplete(keyUploaded)} 
          />
        );
      
      case OnboardingStep.COMPLETE:
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4">Onboarding Complete!</h2>
            <p className="mb-6">
              You&apos;ve successfully connected your GCP account and selected your project.
              {serviceAccountKeyUploaded 
                ? ' We will now be able to manage your VM instances automatically with your provided service account key.'
                : ' Note: Since you didn\'t upload a service account key, some features that manage VMs will be limited.'}
            </p>
            <button
              onClick={completeOnboarding}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Set Up IdleOps</h1>
        
        {/* Progress indicator */}
        <div className="flex items-center mb-8">
          {[
            { step: OnboardingStep.CONNECT_GCP, label: 'Connect GCP' },
            { step: OnboardingStep.SELECT_PROJECT, label: 'Select Project' },
            { step: OnboardingStep.VIEW_INSTANCES, label: 'View Instances' },
            { step: OnboardingStep.COMPLETE, label: 'Complete' },
          ].map((item, index) => (
            <div key={index} className="flex items-center">
              <div 
                className={`rounded-full w-8 h-8 flex items-center justify-center ${
                  currentStep >= item.step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              <div 
                className={`ml-2 ${
                  currentStep >= item.step ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}
              >
                {item.label}
              </div>
              {index < 3 && (
                <div 
                  className={`w-12 h-1 mx-2 ${
                    currentStep > item.step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        
        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* Current step content */}
        {renderStepContent()}
      </div>
    </div>
  );
}
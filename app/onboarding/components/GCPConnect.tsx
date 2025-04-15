'use client';

import { useState, useEffect } from 'react';

interface GCPConnectProps {
  onConnected: (token: string) => void;
}

export default function GCPConnect({ onConnected }: GCPConnectProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');
  
  // Google OAuth client ID - in production, store this in environment variables
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''; // Make sure to set this in .env.local
  
  // Required scopes for GCP API access
  const scopes = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/compute',
    'https://www.googleapis.com/auth/compute.readonly'
  ];

  // Set up window-dependent values after component mounts (client-side only)
  useEffect(() => {
    // Only execute client-side code
    if (typeof window !== 'undefined') {
      // Now it's safe to use window
      setRedirectUri(`${window.location.origin}/api/auth/gcp/callback`);
      
      // Set up message listener
      const handleMessage = (event: MessageEvent) => {
        // Ensure the message is from our expected origin
        if (event.origin !== window.location.origin) return;
        
        // Check if this is our auth token
        if (event.data && event.data.type === 'GCP_AUTH_SUCCESS') {
          setIsAuthenticating(false);
          // Find and close the auth window if it exists
          const authWindow = window.open('', 'gcpAuth');
          if (authWindow) authWindow.close();
          
          // Pass the token to the parent component
          onConnected(event.data.token);
        } else if (event.data && event.data.type === 'GCP_AUTH_ERROR') {
          setIsAuthenticating(false);
          const authWindow = window.open('', 'gcpAuth');
          if (authWindow) authWindow.close();
          console.error('Authentication error:', event.data.error);
        }
      };

      // Add event listener
      window.addEventListener('message', handleMessage);
      
      // Clean up on unmount
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [onConnected]);
  
  // Start OAuth flow
  const connectGCP = () => {
    if (!redirectUri) {
      console.error('Redirect URI not set yet');
      return;
    }
    
    setIsAuthenticating(true);
    
    // Create OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    
    // Open OAuth popup - safely access window
    if (typeof window !== 'undefined') {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        authUrl.toString(),
        'gcpAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold mb-4">Connect your GCP Account</h2>
      <p className="mb-6 text-gray-600">
        Connect your Google Cloud Platform account to fetch your projects and VM instances.
        IdleOps needs read access to your GCP resources to monitor and optimize them.
      </p>
      
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-medium mb-2">Why connect GCP?</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>View and manage your GCP VM instances in one place</li>
          <li>Monitor resource utilization and cost</li>
          <li>Optimize your cloud resources and reduce waste</li>
          <li>Automate instance management based on usage patterns</li>
        </ul>
      </div>
      
      <button
        onClick={connectGCP}
        disabled={isAuthenticating || !redirectUri}
        className="flex items-center justify-center w-full md:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isAuthenticating ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Connect GCP Account
          </>
        )}
      </button>
    </div>
  );
} 
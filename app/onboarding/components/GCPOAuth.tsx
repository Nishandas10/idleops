'use client';

import { useState, useEffect } from 'react';

interface GCPOAuthProps {
  onTokenReceived: (token: string) => void;
  onError: (error: string) => void;
}

export default function GCPOAuth({ onTokenReceived, onError }: GCPOAuthProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  useEffect(() => {
    // Start the OAuth flow immediately when component mounts
    startOAuthFlow();
    
    // Set up message listener for OAuth popup response
    const handleMessage = (event: MessageEvent) => {
      // Ensure the message is from our expected origin
      if (event.origin !== window.location.origin) return;
      
      // Check if this is our auth token
      if (event.data && event.data.type === 'GCP_AUTH_SUCCESS') {
        setIsAuthenticating(false);
        // Close the auth window if it exists
        const authWindow = window.open('', 'gcpAuth');
        if (authWindow) authWindow.close();
        
        // Pass the token to the parent component
        onTokenReceived(event.data.token);
      } else if (event.data && event.data.type === 'GCP_AUTH_ERROR') {
        setIsAuthenticating(false);
        const authWindow = window.open('', 'gcpAuth');
        if (authWindow) authWindow.close();
        onError(event.data.error || 'Failed to authenticate with Google Cloud');
      }
    };

    // Add event listener
    window.addEventListener('message', handleMessage);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onTokenReceived, onError]);
  
  // Start OAuth flow
  const startOAuthFlow = () => {
    if (typeof window === 'undefined') {
      return;
    }
    
    setIsAuthenticating(true);
    
    // Get the client ID from environment
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      onError('Google Client ID not configured');
      setIsAuthenticating(false);
      return;
    }
    
    // Set up the redirect URI - callback will be handled by our API route
    const redirectUri = `${window.location.origin}/api/auth/gcp/callback`;
    
    // Required scopes for GCP API access
    const scopes = [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/compute',
      'https://www.googleapis.com/auth/compute.readonly'
    ];
    
    // Create OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('include_granted_scopes', 'true');
    
    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      authUrl.toString(),
      'gcpAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  // This component renders a simple loading state while OAuth is happening
  return isAuthenticating ? (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin mr-3 h-5 w-5 text-blue-600">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <span>Connecting to Google Cloud...</span>
    </div>
  ) : null;
} 
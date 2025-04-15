'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { getAuth } from 'firebase/auth';

// Create a context for GCP OAuth
type GCPOAuthContextType = {
  token: string | null;
  error: string | null;
  isAuthenticating: boolean;
};

const GCPOAuthContext = createContext<GCPOAuthContextType>({
  token: null,
  error: null,
  isAuthenticating: false
});

// Export the provider and hook
export const GCPOAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  return (
    <GCPOAuthContext.Provider value={{ token, error, isAuthenticating }}>
      {children}
    </GCPOAuthContext.Provider>
  );
};

export const useGCPOAuth = () => useContext(GCPOAuthContext);

// No props needed for the component
export default function GCPOAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  useEffect(() => {
    // First get the current user's email from Firebase
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email) {
      setUserEmail(currentUser.email);
      // Start OAuth flow after we have the email
      startOAuthFlow(currentUser.email);
    } else {
      console.error('No authenticated user found');
    }
    
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
        
        // Verify that the id_token email matches the current user email
        if (event.data.id_token) {
          try {
            // Simple JWT parsing (this is just for logging - actual validation happens on the server)
            const parts = event.data.id_token.split('.');
            const payload = JSON.parse(atob(parts[1]));
            console.log('Authenticated with Google account:', payload.email);
            
            // Verify this matches the expected user email
            if (userEmail && payload.email !== userEmail) {
              console.warn(`Warning: Authorized with ${payload.email} but expected ${userEmail}`);
            }
          } catch (err) {
            console.error('Error parsing id_token:', err);
          }
        }
        
        // Store the token in localStorage
        localStorage.setItem('gcpToken', event.data.token);
        
        // Reload the page to pick up the token from localStorage
        window.location.reload();
      } else if (event.data && event.data.type === 'GCP_AUTH_ERROR') {
        setIsAuthenticating(false);
        const authWindow = window.open('', 'gcpAuth');
        if (authWindow) authWindow.close();
        
        // Set error in localStorage
        localStorage.setItem('gcpOAuthError', event.data.error || 'Failed to authenticate with Google Cloud');
        
        // Reload the page to pick up the error
        window.location.reload();
      }
    };

    // Add event listener
    window.addEventListener('message', handleMessage);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [userEmail]);
  
  // Start OAuth flow
  const startOAuthFlow = (email: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    
    setIsAuthenticating(true);
    
    // Get the client ID from environment
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID not configured');
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
    // Add login_hint to ensure the correct Google account is used
    authUrl.searchParams.append('login_hint', email);
    
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
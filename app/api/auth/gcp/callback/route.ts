import { NextRequest, NextResponse } from "next/server";

// Google OAuth configuration
const clientId = process.env.GOOGLE_CLIENT_ID || ""; // Make sure this is set in your .env.local file
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ""; // Make sure this is set in your .env.local file
const redirectUri =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:3000/api/auth/gcp/callback";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle OAuth error
    if (error) {
      return new Response(
        `
        <html>
          <head>
            <title>Authentication Error</title>
            <script>
              window.opener.postMessage(
                { 
                  type: 'GCP_AUTH_ERROR',
                  error: '${error}'
                },
                window.location.origin
              );
              window.close();
            </script>
          </head>
          <body>
            <p>Authentication error. This window should close automatically.</p>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    // No code received
    if (!code) {
      return new Response(
        `
        <html>
          <head>
            <title>Authentication Error</title>
            <script>
              window.opener.postMessage(
                { 
                  type: 'GCP_AUTH_ERROR',
                  error: 'No authorization code received'
                },
                window.location.origin
              );
              window.close();
            </script>
          </head>
          <body>
            <p>Authentication error. This window should close automatically.</p>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    // Exchange code for token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      return new Response(
        `
        <html>
          <head>
            <title>Token Exchange Error</title>
            <script>
              window.opener.postMessage(
                { 
                  type: 'GCP_AUTH_ERROR',
                  error: 'Failed to exchange code for token'
                },
                window.location.origin
              );
              window.close();
            </script>
          </head>
          <body>
            <p>Failed to exchange code for token. This window should close automatically.</p>
          </body>
        </html>
        `,
        {
          status: 400,
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token } = tokenData;

    // Return success page with script to pass token back to opener window
    return new Response(
      `
      <html>
        <head>
          <title>Authentication Successful</title>
          <script>
            window.opener.postMessage(
              { 
                type: 'GCP_AUTH_SUCCESS',
                token: '${access_token}',
                refreshToken: '${refresh_token || ""}'
              },
              window.location.origin
            );
            window.close();
          </script>
        </head>
        <body>
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="green" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 style="color: #333; margin-top: 1rem;">Authentication Successful</h2>
            <p style="color: #666;">You may close this window and return to the application.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (error) {
    console.error("GCP OAuth Callback Error:", error);

    return new Response(
      `
      <html>
        <head>
          <title>Server Error</title>
          <script>
            window.opener.postMessage(
              { 
                type: 'GCP_AUTH_ERROR',
                error: 'Server error during authentication'
              },
              window.location.origin
            );
            window.close();
          </script>
        </head>
        <body>
          <p>Server error during authentication. This window should close automatically.</p>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  }
}

import { NextRequest } from "next/server";
import axios from "axios";

// Google OAuth configuration
const clientId = process.env.GOOGLE_CLIENT_ID || ""; // Make sure this is set in your .env.local file
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ""; // Make sure this is set in your .env.local file
const redirectUri =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:3000/api/auth/gcp/callback";

export async function GET(request: NextRequest) {
  try {
    // Get the authorization code from the query parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // If there's an error or no code, return error
    if (error) {
      return new Response(
        `
        <html>
          <head>
            <title>Authentication Error</title>
            <script>
              // Send error message to parent window
              window.opener.postMessage(
                { type: 'GCP_AUTH_ERROR', error: '${error}' },
                window.location.origin
              );
            </script>
          </head>
          <body>
            <p>Authentication failed. This window will close automatically.</p>
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

    if (!code) {
      return new Response(
        `
        <html>
          <head>
            <title>Authentication Error</title>
            <script>
              // Send error message to parent window
              window.opener.postMessage(
                { type: 'GCP_AUTH_ERROR', error: 'No authorization code provided' },
                window.location.origin
              );
            </script>
          </head>
          <body>
            <p>Authentication failed. This window will close automatically.</p>
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

    // Exchange the code for an access token
    const tokenEndpoint = "https://oauth2.googleapis.com/token";
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/gcp/callback`;

    const tokenResponse = await axios.post(
      tokenEndpoint,
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Extract the access token
    const { access_token } = tokenResponse.data;

    // Return an HTML page that sends the token to the opener window
    return new Response(
      `
      <html>
        <head>
          <title>Authentication Successful</title>
          <script>
            // Send the token back to the opener window
            window.opener.postMessage(
              { type: 'GCP_AUTH_SUCCESS', token: '${access_token}' },
              window.location.origin
            );
          </script>
        </head>
        <body>
          <p>Authentication successful! You can close this window.</p>
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
    console.error("Error in GCP OAuth callback:", error);

    return new Response(
      `
      <html>
        <head>
          <title>Authentication Error</title>
          <script>
            // Send error message to parent window
            window.opener.postMessage(
              { type: 'GCP_AUTH_ERROR', error: 'Error exchanging code for token' },
              window.location.origin
            );
          </script>
        </head>
        <body>
          <p>Authentication failed. This window will close automatically.</p>
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

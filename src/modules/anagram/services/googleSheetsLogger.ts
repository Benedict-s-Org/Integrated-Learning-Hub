import { RunPayload } from "./notionLogger";

// Replace this with the Web App URL generated from Google Apps Script after deployment
export const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxrlE4w98tp84YQGezjpAyafmyx3QB-uVcn-ED9xwTCQyKtmlq_CjDl832x_bLW4AeX/exec";

/**
 * Post a Run and its Responses directly to the Google Apps Script Webhook
 */
export async function postRunToGoogleSheet(payload: any) {
  if (GOOGLE_APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    console.warn("Google Apps Script URL is not set. Skipping data sync.");
    return { status: "skipped", message: "URL not configured" };
  }

  try {
    const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        // Warning: 'Content-Type': 'application/json' often triggers CORS preflight issues with standard webhooks.
        // Google Apps script handles text/plain without preflight, but we implemented doOptions in the script to handle JSON perfectly.
        "Content-Type": "text/plain;charset=utf-8", 
      },
      // Important to use no-cors if preflight fails, but if you want to read the response you need cors.
      // We will try standard 'cors' mode since doOptions is implemented in the App Script snippet.
      mode: "cors"
    });

    if (!res.ok) {
        throw new Error(`Failed to post run to Google Sheets: ${res.status}`);
    }

    const data = await res.json();
    console.log("Google Sheets Log Success:", data);
    return data;
  } catch (error) {
    console.error("Error posting run to Google Sheets:", error);
    // Silent fail so we don't crash the user experience
    throw error;
  }
}

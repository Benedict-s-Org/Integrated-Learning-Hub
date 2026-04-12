import { RunPayload } from "./notionLogger";

// Replace this with the Web App URL generated from Google Apps Script after deployment
export const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxrlE4w98tp84YQGezjpAyafmyx3QB-uVcn-ED9xwTCQyKtmlq_CjDl832x_bLW4AeX/exec";

/**
 * Post a Run and its Responses directly to the Google Apps Script Webhook
 */
export async function postRunToGoogleSheet(payload: any) {
  console.log("DEBUG: Hitting Google Apps Script URL:", GOOGLE_APPS_SCRIPT_URL);
  if (GOOGLE_APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    console.warn("Google Apps Script URL is not set. Skipping data sync.");
    return { status: "skipped", message: "URL not configured" };
  }

  try {
    // We use URLSearchParams to send data as a standard form-encoded string.
    // This is the most compatible way to hit Google Apps Script's doPost(e.parameter).
    const formData = new URLSearchParams();
    for (const key in payload) {
      if (typeof payload[key] === 'object') {
        formData.append(key, JSON.stringify(payload[key]));
      } else {
        formData.append(key, payload[key]);
      }
    }

    const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      body: formData.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded", 
      },
      mode: "no-cors"
    });

    // In no-cors mode, the response is 'opaque'. We cannot check res.ok or read the status/body.
    // If the code reaches here and haven't jumped to the 'catch' block, the request was successfully sent.
    return { status: "success", message: "Data packet successfully sent to Google Sheets (no-cors mode)" };
  } catch (error) {
    console.error("Error posting run to Google Sheets:", error);
    // Silent fail so we don't crash the user experience
    throw error;
  }
}

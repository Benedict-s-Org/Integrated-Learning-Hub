/**
 * Manual test script for Flowith API.
 * Run this to check if your network/API key can reach Flowith directly.
 * 
 * Usage: 
 * 1. Replace 'YOUR_API_KEY'
 * 2. Run with: npx ts-node test-flowith.ts
 */

const API_KEY = 'YOUR_FLOWITH_API_KEY'; // Replace with actual key

async function testFlowith() {
    console.log("Testing connection to Flowith...");
    try {
        const response = await fetch(
            "https://api.flowith.io/external/use/seek-knowledge/models",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response (first 500 chars):", text.slice(0, 500));

        if (response.status === 522) {
            console.error("❌ 522 Connection Timed Out. This is likely a Flowith server issue or regional block.");
        } else if (response.ok) {
            console.log("✅ Connection Successful!");
        }
    } catch (err: any) {
        console.error("❌ Fetch Error:", err.message);
    }
}

testFlowith();

const OAuthClient = require('intuit-oauth');

// --- PASTE YOUR KEYS HERE ---
const REFRESH_TOKEN = 'RT1-134-H0-1781134898fkqr3wh52dflp1x8h25d';
const CLIENT_ID = 'ABSLR3oreZAlb0pQsR8nvaMLeMF5EK3IQbYJCGZ2chkUuG0h1K';
const CLIENT_SECRET = 'vfumnWSEhjrpECdSlXrV0PRK6DTsLuM23yexCT2Y';
const REALM_ID = '9341456470897772';

const oauthClient = new OAuthClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    environment: 'sandbox',
    redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

async function wipeSandbox() {
    try {
        oauthClient.getToken().setToken({
            token_type: 'bearer',
            refresh_token: REFRESH_TOKEN,
            x_refresh_token_expires_in: 8726400,
            expires_in: 3600
        });

        await oauthClient.refresh();
        console.log("🔥 Connected to Sandbox! Initiating Wipe Protocol...");

        // Helper function to delete records
        async function deleteRecords(entityName) {
            console.log(`\n🔍 Searching for all ${entityName}s...`);
            const query = `SELECT * FROM ${entityName} MAXRESULTS 1000`;
            const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/query?query=${encodeURIComponent(query)}&minorversion=65`;

            const response = await oauthClient.makeApiCall({ url, method: 'GET' });
            const data = response.json || JSON.parse(response.text?.() || '{}');

            const records = data.QueryResponse[entityName];

            if (!records || records.length === 0) {
                console.log(`✅ No ${entityName}s found. Moving on.`);
                return;
            }

            console.log(`⚠️ Found ${records.length} ${entityName}s. Commencing deletion...`);

            for (const record of records) {
                const deleteBody = {
                    "Id": record.Id,
                    "SyncToken": record.SyncToken
                };

                await oauthClient.makeApiCall({
                    url: `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/${entityName.toLowerCase()}?operation=delete&minorversion=65`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(deleteBody)
                });
                process.stdout.write('💥'); // Explosion emoji for every deleted item
            }
            console.log(`\n✅ All ${entityName}s successfully deleted.`);
        }

        // Execute deletions
        await deleteRecords('Deposit');
        await deleteRecords('Purchase');

        console.log("\n🧹 SANDBOX WIPE COMPLETE! You have a blank slate.");

    } catch (error) {
        console.error("Error wiping data:", error.authResponse ? error.authResponse.json : error);
    }
}

wipeSandbox();
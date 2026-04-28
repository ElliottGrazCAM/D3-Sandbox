const OAuthClient = require('intuit-oauth');

// --- PASTE YOUR KEYS HERE ---
const REFRESH_TOKEN = 'RT1-20-H0-1786068826v693ip5qs14kp1tfalp7';
const CLIENT_ID = 'ABSLR3oreZAlb0pQsR8nvaMLeMF5EK3IQbYJCGZ2chkUuG0h1K';
const CLIENT_SECRET = 'vfumnWSEhjrpECdSlXrV0PRK6DTsLuM23yexCT2Y';
const REALM_ID = '9341456470897772';

const oauthClient = new OAuthClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    environment: 'sandbox',
    redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

async function fetchChartOfAccounts() {
    try {
        oauthClient.getToken().setToken({
            token_type: 'bearer',
            refresh_token: REFRESH_TOKEN,
            x_refresh_token_expires_in: 8726400,
            expires_in: 3600
        });

        await oauthClient.refresh();
        console.log("Connected! Pulling your Chart of Accounts...\n");

        const query = "SELECT * FROM Account MAXRESULTS 1000";
        const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/query?query=${encodeURIComponent(query)}&minorversion=65`;

        const response = await oauthClient.makeApiCall({ url, method: 'GET' });
        const data = response.json || JSON.parse(response.text?.() || '{}');

        const accounts = data.QueryResponse.Account;

        if (accounts) {
            console.log("=== YOUR QUICKBOOKS ACCOUNT IDs ===");
            accounts.forEach(acc => {
                // Formatting it nicely so you can easily copy-paste into your spreadsheet
                console.log(`${acc.FullyQualifiedName.padEnd(50, '.')} ID: ${acc.Id}`);
            });
        } else {
            console.log("No accounts found.");
        }

    } catch (error) {
        console.error("Error:", error.authResponse ? error.authResponse.json : error);
    }
}

fetchChartOfAccounts();
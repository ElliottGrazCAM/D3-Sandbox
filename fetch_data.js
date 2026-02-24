const OAuthClient = require('intuit-oauth');
const fs = require('fs');

// 1. Initialize the client
const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: 'sandbox', // Use 'sandbox' for testing, 'production' for real data
  redirectUri: 'http://localhost:3000/callback'
});

// 2. Set the initial Refresh Token from your GitHub Secrets
oauthClient.getToken().setToken({
  refresh_token: process.env.QBO_REFRESH_TOKEN
});

console.log("Attempting to refresh the access token...");

// 3. Refresh the token and fetch data
oauthClient.refresh()
  .then(async (authResponse) => {
    console.log("Token refreshed successfully!");
    
    // IMPORTANT: QuickBooks often rotates the Refresh Token. 
    // If you see a different token below, update your GitHub Secret with it!
    console.log("=== NEW REFRESH TOKEN (Check if this changed!) ===");
    console.log(authResponse.token.refresh_token);
    console.log("==================================================");

    const realmId = process.env.QBO_REALM_ID;
    
    // We are querying for Invoices. You can change this to 'Account', 'Vendor', etc.
    const query = "SELECT * FROM Invoice MAXRESULTS 20";
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    console.log("Fetching data from QuickBooks API...");
    
    const response = await oauthClient.makeApiCall({ 
      url, 
      method: 'GET', 
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      } 
    });
    
    // 4. Save the response to data.json
    const data = response.getJson();
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    
    console.log("SUCCESS: data.json has been created with", (data.QueryResponse.Invoice || []).length, "invoices.");
  })
  .catch(e => {
    console.error("ERROR REFRESHING DATA:");
    
    // Detailed error logging to help us debug
    if (e.authResponse && e.authResponse.json) {
      console.error(JSON.stringify(e.authResponse.json, null, 2));
    } else {
      console.error(e);
    }
    
    // Exit with error so the GitHub Action knows it failed
    process.exit(1);
  });

const OAuthClient = require('intuit-oauth');
const fs = require('fs');

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: 'sandbox', // Change to 'production' later
  redirectUri: 'http://localhost:3000/callback'
});

// Use the refresh token to get a temporary access token
oauthClient.refreshFrom(process.env.QBO_REFRESH_TOKEN)
  .then(async (authResponse) => {
    const realmId = process.env.QBO_REALM_ID;
    
    // Example: Querying for Invoices
    const query = "SELECT * FROM Invoice MAXRESULTS 10";
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const response = await oauthClient.makeApiCall({ url, method: 'GET', headers: { 'Content-Type': 'application/json' } });
    
    // Save the data for D3 to use
    fs.writeFileSync('data.json', JSON.stringify(response.getJson(), null, 2));
    console.log("Data refreshed successfully!");
  })
  .catch(e => console.error("Error refreshing data:", e));

const OAuthClient = require('intuit-oauth');
const fs = require('fs');

const oauthClient = new OAuthClient({
  clientId: process.env.QBO_CLIENT_ID,
  clientSecret: process.env.QBO_CLIENT_SECRET,
  environment: 'sandbox', 
  redirectUri: 'http://localhost:3000/callback'
});

// The fix: Changed .refreshFrom() to .refresh()
// We pass the token inside the configuration or set it manually
oauthClient.getToken().setToken({
    refresh_token: process.env.QBO_REFRESH_TOKEN
});

oauthClient.refresh()
  .then(async (authResponse) => {
    const realmId = process.env.QBO_REALM_ID;
    
    // Querying for Invoices
    const query = "SELECT * FROM Invoice MAXRESULTS 10";
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const response = await oauthClient.makeApiCall({ 
        url, 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' } 
    });
    
    // Save the data for D3 to use
    fs.writeFileSync('data.json', JSON.stringify(response.getJson(), null, 2));
    console.log("Data refreshed successfully!");
  })
  .catch(e => {
      console.error("Error refreshing data:", e);
      // This will help us see the actual error from Intuit if the token is wrong
      if (e.authResponse) console.log(JSON.stringify(e.authResponse.json, null, 2));
  });

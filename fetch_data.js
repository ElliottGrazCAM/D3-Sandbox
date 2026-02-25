const OAuthClient = require('intuit-oauth');
const fs = require('fs');

if (!process.env.QBO_REFRESH_TOKEN || !process.env.QBO_CLIENT_ID) {
    console.error("CRITICAL ERROR: Secrets are missing entirely.");
    process.exit(1);
}

const cleanRefreshToken = process.env.QBO_REFRESH_TOKEN.trim();
const cleanClientId = process.env.QBO_CLIENT_ID.trim();
const cleanClientSecret = process.env.QBO_CLIENT_SECRET.trim();
const cleanRealmId = process.env.QBO_REALM_ID.trim();

const oauthClient = new OAuthClient({
  clientId: cleanClientId,
  clientSecret: cleanClientSecret,
  environment: 'sandbox', 
  redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

oauthClient.getToken().setToken({
  token_type: 'bearer',
  refresh_token: cleanRefreshToken,
  x_refresh_token_expires_in: 8726400,
  expires_in: 3600
});

console.log("Attempting to refresh the access token...");

oauthClient.refresh()
  .then(async (authResponse) => {
    console.log("🎉 SUCCESS: Connection established!");
    
    console.log("Saving new refresh token to temporary file...");
    fs.writeFileSync('new_token.txt', authResponse.token.refresh_token);

    const query = "SELECT * FROM Invoice MAXRESULTS 20";
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${cleanRealmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const response = await oauthClient.makeApiCall({ 
      url, method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } 
    });
    
    // THE FIX: Safely parse the JSON using the modern property instead of the outdated function
    const data = response.json || JSON.parse(response.text?.() || '{}');
    
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    
    console.log("SUCCESS: data.json has been created!");
  })
  .catch(e => {
    console.error("ERROR REFRESHING DATA:");
    if (e.authResponse && e.authResponse.json) {
      console.error(JSON.stringify(e.authResponse.json, null, 2));
    } else {
      console.error(e);
    }
    process.exit(1);
  });

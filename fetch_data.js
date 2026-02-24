const OAuthClient = require('intuit-oauth');
const fs = require('fs');

if (!process.env.QBO_REFRESH_TOKEN || !process.env.QBO_CLIENT_ID) {
    console.error("CRITICAL ERROR: Secrets are missing entirely.");
    process.exit(1);
}

// THE FIX: .trim() removes any hidden spaces or newlines accidentally pasted into GitHub
const cleanRefreshToken = process.env.QBO_REFRESH_TOKEN.trim();
const cleanClientId = process.env.QBO_CLIENT_ID.trim();
const cleanClientSecret = process.env.QBO_CLIENT_SECRET.trim();
const cleanRealmId = process.env.QBO_REALM_ID.trim();

// SAFE DIAGNOSTICS: Let's check the lengths and first letters to ensure nothing got swapped
console.log("--- CREDENTIAL HEALTH CHECK ---");
console.log(`Client ID length: ${cleanClientId.length} (Starts with: ${cleanClientId.substring(0,4)}...)`);
console.log(`Refresh Token length: ${cleanRefreshToken.length} (Starts with: ${cleanRefreshToken.substring(0,4)}...)`);
console.log(`Realm ID length: ${cleanRealmId.length}`);
console.log("-------------------------------");

if (cleanRefreshToken.length > 200) {
    console.error("🚨 WAIT! Your Refresh Token is too long. You accidentally copied the Access Token! Go back to the playground and copy the Refresh Token instead.");
    process.exit(1);
}

const oauthClient = new OAuthClient({
  clientId: cleanClientId,
  clientSecret: cleanClientSecret,
  environment: 'sandbox', 
  redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl' // Matched to Playground just in case
});

oauthClient.getToken().setToken({
  refresh_token: cleanRefreshToken
});

console.log("Attempting to refresh the access token...");

oauthClient.refresh()
  .then(async (authResponse) => {
    console.log("🎉 SUCCESS: Connection established!");
    
    console.log("=== NEW REFRESH TOKEN (Update GitHub with this if it rotated!) ===");
    console.log(authResponse.token.refresh_token);
    console.log("==================================================================");

    const query = "SELECT * FROM Invoice MAXRESULTS 20";
    const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${cleanRealmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

    const response = await oauthClient.makeApiCall({ 
      url, method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } 
    });
    
    const data = response.getJson();
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

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

    // --- THE DATA HARVESTER LOOP ---
    let allDeposits = [];
    let startPosition = 1;
    const maxResults = 2;
    let keepFetching = true;

    console.log("Starting full data harvest for Deposits (2024 to Present)...");

    while (keepFetching) {
      // Querying all deposits from Jan 1, 2024 to today
      const query = `SELECT * FROM Deposit WHERE TxnDate >= '2024-01-01' STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
      const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${cleanRealmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

      console.log(`Fetching records ${startPosition} to ${startPosition + maxResults - 1}...`);

      const response = await oauthClient.makeApiCall({
        url, method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });

      const responseData = response.json || JSON.parse(response.text?.() || '{}');

      // Check if there are deposits in this batch
      if (responseData.QueryResponse && responseData.QueryResponse.Deposit) {
        const deposits = responseData.QueryResponse.Deposit;

        // Add this batch to our master list
        allDeposits = allDeposits.concat(deposits);

        // If QBO returns fewer than 1000 records, we have reached the end!
        if (deposits.length < maxResults) {
          keepFetching = false;
        } else {
          // Otherwise, bump the start position for the next loop
          startPosition += maxResults;
        }
      } else {
        // No deposits found at all, stop the loop
        keepFetching = false;
      }
    }

    // Wrap the master array in a clean JSON structure
    const finalData = {
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalDepositsFound: allDeposits.length
      },
      Deposits: allDeposits
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));

    console.log(`✅ SUCCESS: Harvested ${allDeposits.length} deposits and saved to data.json!`);
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
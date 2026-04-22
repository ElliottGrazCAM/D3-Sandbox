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

oauthClient.refresh()
  .then(async (authResponse) => {
    console.log("🎉 SUCCESS: Connection established!");
    fs.writeFileSync('new_token.txt', authResponse.token.refresh_token);

    // --- HELPER FUNCTION FOR PAGINATION ---
    // Added a whereClause parameter that defaults to empty
    async function fetchAll(entityName, whereClause = "") {
      let allRecords = [];
      let startPosition = 1;
      const maxResults = 1000;
      let keepFetching = true;

      console.log(`Starting full harvest for ${entityName}...`);

      while (keepFetching) {
        // Injects the whereClause safely
        const query = `SELECT * FROM ${entityName} ${whereClause} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
        const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${cleanRealmId}/query?query=${encodeURIComponent(query)}&minorversion=65`;

        console.log(`Fetching ${entityName} records ${startPosition} to ${startPosition + maxResults - 1}...`);

        const response = await oauthClient.makeApiCall({
          url, method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });

        const responseData = response.json || JSON.parse(response.text?.() || '{}');

        if (responseData.QueryResponse && responseData.QueryResponse[entityName]) {
          const records = responseData.QueryResponse[entityName];
          allRecords = allRecords.concat(records);

          if (records.length < maxResults) {
            keepFetching = false;
          } else {
            startPosition += maxResults;
          }
        } else {
          keepFetching = false;
        }
      }
      return allRecords;
    }

    // --- EXECUTE ALL THREE LOOPS ---
    const dateFilter = "WHERE TxnDate >= '2023-01-01'";

    // Transactions need the date filter
    const allDeposits = await fetchAll('Deposit', dateFilter);
    const allExpenses = await fetchAll('Purchase', dateFilter);

    // Budgets do NOT use TxnDate, so we omit the filter
    const allBudgets = await fetchAll('Budget');

    // Wrap the master arrays in a clean JSON structure
    const finalData = {
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalDepositsFound: allDeposits.length,
        totalExpensesFound: allExpenses.length,
        totalBudgetsFound: allBudgets.length
      },
      Deposits: allDeposits,
      Expenses: allExpenses,
      Budgets: allBudgets // Added the budget array here!
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));

    console.log(`✅ SUCCESS: Harvested ${allDeposits.length} deposits, ${allExpenses.length} expenses, and ${allBudgets.length} budgets!`);
  })
  .catch(e => {
    console.error("ERROR REFRESHING DATA:", e);
    process.exit(1);
  });
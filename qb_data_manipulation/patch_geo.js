const OAuthClient = require('intuit-oauth');

// === 1. PASTE YOUR KEYS HERE ===
const CLIENT_ID = 'ABSLR3oreZAlb0pQsR8nvaMLeMF5EK3IQbYJCGZ2chkUuG0h1K';
const CLIENT_SECRET = 'vfumnWSEhjrpECdSlXrV0PRK6DTsLuM23yexCT2Y';
const REFRESH_TOKEN = 'RT1-20-H0-1786068826v693ip5qs14kp1tfalp7';
const REALM_ID = '9341456470897772';

const oauthClient = new OAuthClient({
    clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, environment: 'sandbox', redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

oauthClient.getToken().setToken({ token_type: 'bearer', refresh_token: REFRESH_TOKEN, x_refresh_token_expires_in: 8726400, expires_in: 3600 });

// === 2. METADATA GENERATORS ===
const STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'WA', 'AZ', 'CO', 'MA', 'VA'];
const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const VENDORS = ['TechFlow Solutions', 'Acme Corp', 'Global Dynamics', 'Summit Catering', 'City Center Venue', 'Apex Audio Visual'];

function getRandomGeo() { return { state: STATES[Math.floor(Math.random() * STATES.length)], zip: Math.floor(Math.random() * 89999 + 10000).toString() }; }
function getRandomPerson() { return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`; }
function getRandomVendor() { return VENDORS[Math.floor(Math.random() * VENDORS.length)]; }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

oauthClient.refresh().then(async () => {
    console.log("🎉 Connection established! Hunting for naked transactions...");

    async function fetchAndFilter(entityName) {
        let nakedRecords = [];
        let startPosition = 1;
        let keepFetching = true;

        while (keepFetching) {
            const query = `SELECT * FROM ${entityName} STARTPOSITION ${startPosition} MAXRESULTS 1000`;
            const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/query?query=${encodeURIComponent(query)}&minorversion=65`;

            const response = await oauthClient.makeApiCall({ url, method: 'GET', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } });
            const data = response.json || JSON.parse(response.text?.() || '{}');

            if (data.QueryResponse && data.QueryResponse[entityName]) {
                const records = data.QueryResponse[entityName];

                // FILTER: Only keep records that DO NOT have "Geo:" in the PrivateNote
                const missingGeo = records.filter(r => !r.PrivateNote || !r.PrivateNote.includes("Geo:"));
                nakedRecords = nakedRecords.concat(missingGeo);

                if (records.length < 1000) keepFetching = false;
                else startPosition += 1000;
            } else {
                keepFetching = false;
            }
        }
        return nakedRecords;
    }

    // 1. Find the naked transactions
    const nakedDeposits = await fetchAndFilter('Deposit');
    const nakedPurchases = await fetchAndFilter('Purchase');
    console.log(`Found ${nakedDeposits.length} Deposits and ${nakedPurchases.length} Purchases missing Geo-data.`);

    const allUpdates = [];

    // 2. Build Sparse Update Payload for Deposits
    nakedDeposits.forEach(txn => {
        let geo = getRandomGeo();
        allUpdates.push({
            type: "Deposit",
            payload: {
                "Id": txn.Id,
                "SyncToken": txn.SyncToken,
                "sparse": true,
                "PrivateNote": `Entity: ${getRandomPerson()} | Geo: ${geo.state}, ${geo.zip}`
            }
        });
    });

    // 3. Build Sparse Update Payload for Purchases
    nakedPurchases.forEach(txn => {
        let geo = getRandomGeo();
        allUpdates.push({
            type: "Purchase",
            payload: {
                "Id": txn.Id,
                "SyncToken": txn.SyncToken,
                "sparse": true,
                "PrivateNote": `Entity: ${getRandomVendor()} | Geo: ${geo.state}, ${geo.zip}`
            }
        });
    });

    if (allUpdates.length === 0) {
        console.log("No transactions need updating! Exiting.");
        return;
    }

    // 4. Batch Update API Call
    console.log(`Preparing to patch ${allUpdates.length} transactions...`);
    const BATCH_SIZE = 30;

    for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
        const chunk = allUpdates.slice(i, i + BATCH_SIZE);
        const batchPayload = {
            "BatchItemRequest": chunk.map((txn, index) => {
                let req = { "bId": `batch_${i + index}`, "operation": "update" };
                req[txn.type] = txn.payload;
                return req;
            })
        };

        const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/batch?minorversion=65`;

        try {
            await oauthClient.makeApiCall({ url, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batchPayload) });
            console.log(`✅ Patched batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(allUpdates.length / BATCH_SIZE)}...`);
            await sleep(300); // Throttle
        } catch (e) {
            console.error(`❌ Error in batch:`, e.response ? e.response.text() : e);
        }
    }

    console.log("\n🚀 ALL MISSING GEO-DATA PATCHED SUCCESSFULLY!");

}).catch(e => { console.error("ERROR REFRESHING TOKEN:", e); });
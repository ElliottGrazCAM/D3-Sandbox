const OAuthClient = require('intuit-oauth');

// === 1. PASTE YOUR KEYS HERE ===
const CLIENT_ID = 'ABSLR3oreZAlb0pQsR8nvaMLeMF5EK3IQbYJCGZ2chkUuG0h1K';
const CLIENT_SECRET = 'vfumnWSEhjrpECdSlXrV0PRK6DTsLuM23yexCT2Y';
const REFRESH_TOKEN = 'RT1-20-H0-1786068826v693ip5qs14kp1tfalp7';
const REALM_ID = '9341456470897772';
const CHECKING_ID = "1150040038";

const oauthClient = new OAuthClient({
    clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, environment: 'sandbox', redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

oauthClient.getToken().setToken({ token_type: 'bearer', refresh_token: REFRESH_TOKEN, x_refresh_token_expires_in: 8726400, expires_in: 3600 });

// === 2. TARGET LEGACY ACCOUNTS ===
const ACCTS = {
    // Memberships & Admin
    DUES_FULL: "1150040040", DUES_PREMIUM: "1150040042", DUES_RETIRED: "1150040041",
    EXP_BANK: "1150040043", EXP_QB: "1150040044", EXP_CC: "1150040048", EXP_GODADDY: "1150040046", EXP_WILDAPRICOT: "1150040047", EXP_ZOOM: "1150040045",

    // Luncheon
    LUNCH_REG: "1150040014", LUNCH_GOLD: "1150040015", LUNCH_SILVER: "1150040035",
    LUNCH_VENUE: "1150040023", LUNCH_FB: "1150040026", LUNCH_AV: "1150040020", LUNCH_SIGNS: "1150040029", LUNCH_PRIZES: "1150040032",

    // Golf
    GOLF_REG: "1150040016", GOLF_GOLD: "1150040017", GOLF_SILVER: "1150040036",
    GOLF_VENUE: "1150040024", GOLF_FB: "1150040027", GOLF_AV: "1150040021", GOLF_SIGNS: "1150040030", GOLF_PRIZES: "1150040033",

    // Gala
    GALA_REG: "1150040018", GALA_GOLD: "1150040019", GALA_SILVER: "1150040037",
    GALA_VENUE: "1150040025", GALA_FB: "1150040028", GALA_AV: "1150040022", GALA_SIGNS: "1150040031", GALA_PRIZES: "1150040034"
};

// === 3. DATA SCIENCE METADATA WORKAROUND ===
const STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'WA', 'AZ', 'CO', 'MA', 'VA'];
const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas'];
const VENDORS = ['TechFlow Solutions', 'Acme Corp', 'Global Dynamics', 'Summit Catering', 'City Center Venue', 'Apex Audio Visual', 'Pinnacle Print Shop', 'Elevate Management'];

function getRandomGeo() { return { state: STATES[Math.floor(Math.random() * STATES.length)], zip: Math.floor(Math.random() * 89999 + 10000).toString() }; }
function getRandomPerson() { return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`; }
function getRandomVendor() { return VENDORS[Math.floor(Math.random() * VENDORS.length)]; }

function formatDate(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function buildLine(type, date, amt, accId, memo) {
    let geo = getRandomGeo();
    let entity = type === 'Deposit' ? getRandomPerson() : getRandomVendor();
    let privateNote = `Entity: ${entity} | Geo: ${geo.state}, ${geo.zip}`;

    let base = { "TxnDate": date, "PrivateNote": privateNote, "Line": [{ "Amount": amt, "Description": memo }] };
    if (type === 'Deposit') {
        base.DepositToAccountRef = { "value": CHECKING_ID };
        base.Line[0].DetailType = "DepositLineDetail";
        base.Line[0].DepositLineDetail = { "AccountRef": { "value": accId } };
    } else {
        base.AccountRef = { "value": CHECKING_ID };
        base.PaymentType = "Cash";
        base.Line[0].DetailType = "AccountBasedExpenseLineDetail";
        base.Line[0].AccountBasedExpenseLineDetail = { "AccountRef": { "value": accId } };
    }
    return base;
}

// === 4. GENERATION ENGINE ===
let transactions = [];
console.log("Generating Legacy Data (2016-2022) & Margin Fixes (2023-2025)...");

// PART 1: 2016 - 2022 Backfill
for (let year = 2016; year <= 2022; year++) {
    let yrOffset = year - 2016; // 0 to 6

    // Software & Memberships
    for (let m = 1; m <= 12; m++) {
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, m, 3), 60 + (yrOffset * 10), ACCTS.EXP_CC, "Constant Contact Monthly") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, m, 8), 25 + (yrOffset * 3), ACCTS.EXP_GODADDY, "GoDaddy Monthly") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, m, 28), rInt(50 + (yrOffset * 10), 100 + (yrOffset * 20)), ACCTS.EXP_BANK, "Bank & Merchant Fees") });
        if (year >= 2020) transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, m, 22), 50 + ((year - 2020) * 5), ACCTS.EXP_ZOOM, "Zoom Subscription") });
    }
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 10, 5), 120 + (yrOffset * 15), ACCTS.EXP_QB, "QuickBooks Annual") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 4, 15), 300 + (yrOffset * 35), ACCTS.EXP_WILDAPRICOT, "Wild Apricot Annual") });

    let fullCount = 100 + (yrOffset * 20); let premCount = 20 + (yrOffset * 5); let retCount = 30 + (yrOffset * 2);
    for (let i = 0; i < fullCount; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(1, 12), rInt(1, 28)), 100 + (yrOffset * 5), ACCTS.DUES_FULL, "Full Member Dues") });
    for (let i = 0; i < premCount; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(1, 12), rInt(1, 28)), 200 + (yrOffset * 10), ACCTS.DUES_PREMIUM, "Premium Member Dues") });
    for (let i = 0; i < retCount; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(1, 12), rInt(1, 28)), 75 + (yrOffset * 5), ACCTS.DUES_RETIRED, "Retired Member Dues") });

    // In-Person Events (Canceled during COVID 2020-2021)
    if (year !== 2020 && year !== 2021) {
        // Luncheon
        for (let i = 0; i < 200 + (yrOffset * 20); i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(3, 5), rInt(1, 28)), 60 + (yrOffset * 5), ACCTS.LUNCH_REG, "Luncheon Ticket") });
        for (let i = 0; i < 3; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 4, rInt(1, 28)), 5000 + (yrOffset * 1000), ACCTS.LUNCH_GOLD, "Luncheon Gold Sponsor") });
        for (let i = 0; i < 5; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 4, rInt(1, 28)), 2500 + (yrOffset * 500), ACCTS.LUNCH_SILVER, "Luncheon Silver Sponsor") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 5, 10), 10000 + (yrOffset * 2000), ACCTS.LUNCH_VENUE, "Luncheon Venue") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 5, 15), 8000 + (yrOffset * 1500), ACCTS.LUNCH_FB, "Luncheon F&B") });

        // Golf
        for (let i = 0; i < 100 + (yrOffset * 10); i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(5, 7), rInt(1, 28)), 100 + (yrOffset * 10), ACCTS.GOLF_REG, "Golf Registration") });
        for (let i = 0; i < 2; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 6, rInt(1, 28)), 8000 + (yrOffset * 1500), ACCTS.GOLF_GOLD, "Golf Gold Sponsor") });
        for (let i = 0; i < 4; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 6, rInt(1, 28)), 3000 + (yrOffset * 500), ACCTS.GOLF_SILVER, "Golf Silver Sponsor") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 7, 10), 8000 + (yrOffset * 1000), ACCTS.GOLF_VENUE, "Golf Course Fees") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 7, 15), 5000 + (yrOffset * 1000), ACCTS.GOLF_FB, "Golf F&B") });

        // Gala
        for (let i = 0; i < 150 + (yrOffset * 15); i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(9, 11), rInt(1, 28)), 120 + (yrOffset * 10), ACCTS.GALA_REG, "Gala Ticket") });
        for (let i = 0; i < 3; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 10, rInt(1, 28)), 10000 + (yrOffset * 1500), ACCTS.GALA_GOLD, "Gala Gold Sponsor") });
        for (let i = 0; i < 5; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 10, rInt(1, 28)), 4000 + (yrOffset * 800), ACCTS.GALA_SILVER, "Gala Silver Sponsor") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 11, 10), 15000 + (yrOffset * 2500), ACCTS.GALA_VENUE, "Gala Venue") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 11, 15), 12000 + (yrOffset * 2000), ACCTS.GALA_FB, "Gala F&B") });
    }
}

// PART 2: 2023 - 2025 Margin Fixes (Adding huge supplemental expenses to lower profit margins)
for (let year = 2023; year <= 2025; year++) {
    // Fix Luncheon Margin
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 5, 10), 18000, ACCTS.LUNCH_VENUE, "Luncheon Venue (Supplemental Invoice)") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 5, 15), 22000, ACCTS.LUNCH_FB, "Luncheon F&B (Supplemental Invoice)") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 5, 5), 5000, ACCTS.LUNCH_AV, "Luncheon A/V (Supplemental Invoice)") });

    // Fix Golf Margin
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 7, 10), 15000, ACCTS.GOLF_VENUE, "Golf Course Fees (Supplemental Invoice)") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 7, 15), 18000, ACCTS.GOLF_FB, "Golf F&B (Supplemental Invoice)") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 7, 5), 6000, ACCTS.GOLF_AV, "Golf AV/Carts (Supplemental Invoice)") });

    // Fix Gala Margin
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 11, 10), 25000, ACCTS.GALA_VENUE, "Gala Venue (Supplemental Invoice)") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 11, 15), 25000, ACCTS.GALA_FB, "Gala F&B (Supplemental Invoice)") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 11, 5), 8000, ACCTS.GALA_AV, "Gala A/V (Supplemental Invoice)") });
}

// === 5. BATCH UPLOAD ===
oauthClient.refresh().then(async () => {
    console.log(`\n🎉 Connection established! Preparing to inject ${transactions.length} transactions...`);
    const BATCH_SIZE = 30;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const chunk = transactions.slice(i, i + BATCH_SIZE);
        const batchPayload = {
            "BatchItemRequest": chunk.map((txn, index) => {
                let req = { "bId": `batch_${i + index}`, "operation": "create" };
                req[txn.type] = txn.payload;
                return req;
            })
        };

        const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/batch?minorversion=65`;

        try {
            await oauthClient.makeApiCall({ url, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batchPayload) });
            if ((i / BATCH_SIZE) % 10 === 0) console.log(`✅ Injected batch ${Math.floor(i / BATCH_SIZE)} of ${Math.ceil(transactions.length / BATCH_SIZE)}...`);
            await sleep(250);
        } catch (e) {
            console.error(`❌ Error in batch ${Math.floor(i / BATCH_SIZE)}:`, e.response ? e.response.text() : e);
            await sleep(2000);
        }
    }
    console.log("\n🚀 LEGACY DATA & MARGIN FIXES INJECTED SUCCESSFULLY!");
}).catch(e => { console.error("ERROR REFRESHING TOKEN:", e); });
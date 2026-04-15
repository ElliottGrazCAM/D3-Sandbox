const OAuthClient = require('intuit-oauth');

// === PASTE YOUR KEYS HERE JUST FOR THIS SCRIPT ===
const CLIENT_ID = 'ABSLR3oreZAlb0pQsR8nvaMLeMF5EK3IQbYJCGZ2chkUuG0h1K';
const CLIENT_SECRET = 'vfumnWSEhjrpECdSlXrV0PRK6DTsLuM23yexCT2Y';
const REFRESH_TOKEN = 'RT1-194-H0-178088180438kcmctbtxxkwbj4fpi6';
const REALM_ID = '9341456470897772';


const oauthClient = new OAuthClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    environment: 'sandbox',
    redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

oauthClient.getToken().setToken({
    token_type: 'bearer',
    refresh_token: REFRESH_TOKEN,
    x_refresh_token_expires_in: 8726400,
    expires_in: 3600
});

// === ACCOUNT MAPPINGS ===
const CHECKING_ID = "1150040038";

// Income IDs
const DUES_FULL = "1150040040";
const DUES_RETIRED = "1150040041";
const DUES_PREMIUM = "1150040042";

// Expense IDs
const EXP_BANK = "1150040043";
const EXP_QB = "1150040044";
const EXP_CC = "1150040048";
const EXP_GODADDY = "1150040046";
const EXP_WILDAPRICOT = "1150040047";
const EXP_ZOOM = "1150040045";

// === HELPER FUNCTIONS ===
function formatDate(year, month, day) {
    // Ensures single digits get a leading zero (e.g., 2023-05-09)
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function createDeposit(date, amount, accountId, description) {
    return {
        "DepositToAccountRef": { "value": CHECKING_ID },
        "TxnDate": date,
        "Line": [{
            "Amount": amount,
            "DetailType": "DepositLineDetail",
            "Description": description,
            "DepositLineDetail": { "AccountRef": { "value": accountId } }
        }]
    };
}

function createPurchase(date, amount, accountId, description) {
    return {
        "AccountRef": { "value": CHECKING_ID },
        "PaymentType": "Cash",
        "TxnDate": date,
        "Line": [{
            "Amount": amount,
            "DetailType": "AccountBasedExpenseLineDetail",
            "Description": description,
            "AccountBasedExpenseLineDetail": { "AccountRef": { "value": accountId } }
        }]
    };
}

// === DATA GENERATION ===
let transactions = [];

// 1. MEMBERSHIPS (Rolling dates, +5% YoY)
const memberTypes = [
    { type: "Full", id: DUES_FULL, price: 150, count: 50 },
    { type: "Retired", id: DUES_RETIRED, price: 100, count: 20 },
    { type: "Premium", id: DUES_PREMIUM, price: 200, count: 15 }
];

let allMembers = [];
let memberIdCounter = 1;

// Initialize base 2023 Members with random anniversary dates
memberTypes.forEach(mt => {
    for (let i = 0; i < mt.count; i++) {
        allMembers.push({
            memberId: memberIdCounter++,
            type: mt.type,
            id: mt.id,
            price: mt.price,
            joinMonth: randomInt(1, 12),
            joinDay: randomInt(1, 28)
        });
    }
});

for (let year = 2023; year <= 2025; year++) {
    // Process existing members for this year (they renew on their specific date)
    allMembers.forEach(m => {
        let date = formatDate(year, m.joinMonth, m.joinDay);
        transactions.push({
            type: "Deposit",
            payload: createDeposit(date, m.price, m.id, `${year} ${m.type} Member Dues - Member #${m.memberId}`)
        });
    });

    // Add 5% new members for NEXT year (if we are in '23 or '24)
    if (year < 2025) {
        memberTypes.forEach(mt => {
            let currentCount = allMembers.filter(m => m.type === mt.type).length;
            let newMembers = Math.round(currentCount * 0.05);
            for (let i = 0; i < newMembers; i++) {
                allMembers.push({
                    memberId: memberIdCounter++,
                    type: mt.type,
                    id: mt.id,
                    price: mt.price,
                    joinMonth: randomInt(1, 12),
                    joinDay: randomInt(1, 28)
                });
            }
        });
    }
}

// 2. ADMINISTRATIVE & SOFTWARE EXPENSES
let ccPrice = 120;
let godaddyPrice = 45;
let zoomPrice = 75;

for (let year = 2023; year <= 2025; year++) {
    // Annual Software
    let waPrice = year === 2023 ? 500 : (year === 2024 ? 550 : 600);
    transactions.push({ type: "Purchase", payload: createPurchase(formatDate(year, 4, 15), waPrice, EXP_WILDAPRICOT, `${year} Wild Apricot Annual Subscription`) });
    transactions.push({ type: "Purchase", payload: createPurchase(formatDate(year, 10, 5), 224.75, EXP_QB, `${year} QuickBooks Annual Subscription`) });

    for (let month = 1; month <= 12; month++) {
        // Bank Fees (Spike in May, Aug, Sep, Nov)
        let isEventMonth = [5, 8, 9, 11].includes(month);
        let bankFee = isEventMonth ? randomInt(400, 500) : randomInt(100, 200);
        transactions.push({ type: "Purchase", payload: createPurchase(formatDate(year, month, 28), bankFee, EXP_BANK, `${year} Monthly Gateway & Bank Fees`) });

        // Monthly Software
        transactions.push({ type: "Purchase", payload: createPurchase(formatDate(year, month, 3), ccPrice, EXP_CC, `${year} Constant Contact Monthly`) });
        transactions.push({ type: "Purchase", payload: createPurchase(formatDate(year, month, 8), godaddyPrice, EXP_GODADDY, `${year} GoDaddy Monthly`) });
        transactions.push({ type: "Purchase", payload: createPurchase(formatDate(year, month, 22), zoomPrice, EXP_ZOOM, `${year} Zoom Monthly`) });
    }

    // Apply YoY Increases for the next year
    ccPrice = Number((ccPrice * 1.15).toFixed(2));
    godaddyPrice = Number((godaddyPrice * 1.10).toFixed(2));
    zoomPrice = Number((zoomPrice * 1.20).toFixed(2));
}

// === BATCH UPLOAD TO QUICKBOOKS ===
oauthClient.refresh().then(async () => {
    console.log(`🎉 Connection established! Preparing to inject ${transactions.length} transactions...\n`);

    const BATCH_SIZE = 30; // QBO Limit is 30 per batch

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const chunk = transactions.slice(i, i + BATCH_SIZE);

        const batchPayload = {
            "BatchItemRequest": chunk.map((txn, index) => {
                let req = {
                    "bId": `batch_${i + index}`,
                    "operation": "create"
                };
                req[txn.type] = txn.payload; // Assigns the Deposit or Purchase object
                return req;
            })
        };

        const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/batch?minorversion=65`;

        try {
            await oauthClient.makeApiCall({
                url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchPayload)
            });
            console.log(`✅ Successfully injected batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(transactions.length / BATCH_SIZE)}`);
        } catch (e) {
            console.error(`❌ Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, e.response ? e.response.text() : e);
        }
    }

    console.log("\n🚀 ALL SEED DATA INJECTED SUCCESSFULLY!");
}).catch(e => {
    console.error("ERROR REFRESHING TOKEN:", e);
});
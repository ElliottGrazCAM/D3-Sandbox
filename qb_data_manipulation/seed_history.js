const OAuthClient = require('intuit-oauth');

// --- PASTE YOUR KEYS HERE ---
const REFRESH_TOKEN = 'RT1-185-H0-1781148269kmegipzqqi5y4kz50t7e';
const CLIENT_ID = 'ABSLR3oreZAlb0pQsR8nvaMLeMF5EK3IQbYJCGZ2chkUuG0h1K';
const CLIENT_SECRET = 'vfumnWSEhjrpECdSlXrV0PRK6DTsLuM23yexCT2Y';
const REALM_ID = '9341456470897772';

const oauthClient = new OAuthClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    environment: 'sandbox',
    redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

// The single Checking Account
const BANK_ID = "1150040038";

// The Master Chart of Accounts Mapping
const ACCOUNTS = {
    Luncheon: {
        RevReg: "1150040014", RevSilver: "1150040035", RevGold: "1150040015",
        ExpAV: "1150040020", ExpVenue: "1150040023", ExpFB: "1150040026", ExpSignage: "1150040029", ExpPrizes: "1150040032",
        season: { expStart: 4, revStart: 7, end: 10 } // Luncheon in October
    },
    Gala: {
        RevReg: "1150040018", RevSilver: "1150040037", RevGold: "1150040019",
        ExpAV: "1150040022", ExpVenue: "1150040025", ExpFB: "1150040028", ExpSignage: "1150040031", ExpPrizes: "1150040034",
        season: { expStart: 8, revStart: 10, end: 12 } // Gala in December
    },
    Golf: {
        RevReg: "1150040016", RevSilver: "1150040036", RevGold: "1150040017",
        ExpAV: "1150040021", ExpVenue: "1150040024", ExpFB: "1150040027", ExpSignage: "1150040030", ExpPrizes: "1150040033",
        season: { expStart: 2, revStart: 4, end: 6 } // Golf in June
    }
};

// Helpers
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = ms => new Promise(res => setTimeout(res, ms));

// Force an even number (divisible by 2) based on the 90% YoY scaling
const scaleEven = (baseAmount, year) => {
    const scaled = baseAmount * Math.pow(0.9, 2025 - year);
    return Math.round(scaled / 2) * 2;
};

// Get random date within specific months of a given year
function getRandomDate(year, startMonth, endMonth) {
    const start = new Date(year, startMonth - 1, 1);
    const end = new Date(year, endMonth - 1, 28);
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split('T')[0];
}

async function runSeeder() {
    try {
        oauthClient.getToken().setToken({
            token_type: 'bearer', refresh_token: REFRESH_TOKEN, x_refresh_token_expires_in: 8726400, expires_in: 3600
        });
        await oauthClient.refresh();
        console.log("🚀 Connected! Generating 3-Year Blueprint...");

        // --- STEP 1: CREATE THE 2025 BLUEPRINT ---
        // We define exactly how many transactions, and what their base 2025 cost is.
        const events = ['Luncheon', 'Gala', 'Golf'];
        const blueprint = [];

        for (const event of events) {
            const accs = ACCOUNTS[event];

            // 1. REVENUE
            const regCount = randomInt(100, 200);
            for (let i = 1; i <= regCount; i++) blueprint.push({ type: 'Deposit', event, acct: accs.RevReg, baseAmt: 25, desc: `${event} Registrant #${i}` });

            const silverCount = randomInt(10, 20);
            for (let i = 1; i <= silverCount; i++) blueprint.push({ type: 'Deposit', event, acct: accs.RevSilver, baseAmt: 5000, desc: `${event} Silver Sponsor Corp ${i}` });

            const goldCount = randomInt(5, 10);
            for (let i = 1; i <= goldCount; i++) blueprint.push({ type: 'Deposit', event, acct: accs.RevGold, baseAmt: 10000, desc: `${event} Gold Sponsor LLC ${i}` });

            // 2. EXPENSES
            const avCount = randomInt(1, 3);
            for (let i = 1; i <= avCount; i++) blueprint.push({ type: 'Purchase', event, acct: accs.ExpAV, baseAmt: randomInt(1000, 5000), desc: `Vendor: ${event} Audio Visual Co ${i}` });

            const venueCount = randomInt(1, 5);
            for (let i = 1; i <= venueCount; i++) blueprint.push({ type: 'Purchase', event, acct: accs.ExpVenue, baseAmt: 10000, desc: `Vendor: ${event} Event Space ${i}` });

            const fbCount = randomInt(3, 5);
            for (let i = 1; i <= fbCount; i++) blueprint.push({ type: 'Purchase', event, acct: accs.ExpFB, baseAmt: randomInt(1000, 5000), desc: `Vendor: ${event} Catering ${i}` });

            const sigCount = 5;
            for (let i = 1; i <= sigCount; i++) blueprint.push({ type: 'Purchase', event, acct: accs.ExpSignage, baseAmt: randomInt(100, 300), desc: `Vendor: ${event} Printing & Signs ${i}` });

            const prizeCount = randomInt(5, 10);
            for (let i = 1; i <= prizeCount; i++) blueprint.push({ type: 'Purchase', event, acct: accs.ExpPrizes, baseAmt: randomInt(100, 500), desc: `Vendor: ${event} Trophies & Gifts ${i}` });
        }

        // --- STEP 2: EXECUTE BLUEPRINT ACROSS 3 YEARS ---
        const years = [2023, 2024, 2025];
        let counter = 0;

        for (const year of years) {
            console.log(`\n\n📅 Injecting ${year} Data...`);

            for (const item of blueprint) {
                const season = ACCOUNTS[item.event].season;
                const isExpense = item.type === 'Purchase';

                // Assign dates based on event seasonality
                const date = isExpense
                    ? getRandomDate(year, season.expStart, season.end)
                    : getRandomDate(year, season.revStart, season.end);

                // Calculate scaled, even amount
                const finalAmount = scaleEven(item.baseAmt, year);

                // Build the QBO Payload
                let payload = {};
                if (isExpense) {
                    payload = {
                        "AccountRef": { "value": BANK_ID },
                        "PaymentType": "Cash",
                        "TxnDate": date,
                        "Line": [{
                            "Amount": finalAmount,
                            "DetailType": "AccountBasedExpenseLineDetail",
                            "AccountBasedExpenseLineDetail": { "AccountRef": { "value": item.acct } },
                            "Description": item.desc
                        }]
                    };
                } else {
                    payload = {
                        "DepositToAccountRef": { "value": BANK_ID },
                        "TxnDate": date,
                        "Line": [{
                            "Amount": finalAmount,
                            "DetailType": "DepositLineDetail",
                            "DepositLineDetail": { "AccountRef": { "value": item.acct } },
                            "Description": item.desc
                        }]
                    };
                }

                // Send to QBO
                const endpoint = isExpense ? 'purchase' : 'deposit';
                await oauthClient.makeApiCall({
                    url: `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/${endpoint}?minorversion=65`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Console output so you know it's working
                process.stdout.write(isExpense ? '🔴' : '🟢');

                counter++;
                await delay(50); // Prevent API Rate Limiting
            }
        }

        console.log(`\n\n✅ SUCCESS! Injected ${counter} perfectly modeled transactions across 2023, 2024, and 2025.`);

    } catch (error) {
        console.error("\nError:", error.authResponse ? error.authResponse.json : error);
    }
}

runSeeder();
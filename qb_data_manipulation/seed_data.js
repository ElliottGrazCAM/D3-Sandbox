const OAuthClient = require('intuit-oauth');

// === 1. PASTE YOUR KEYS HERE ===
const CLIENT_ID = 'ABSLR3oreZAlb0pQsR8nvaMLeMF5EK3IQbYJCGZ2chkUuG0h1K';
const CLIENT_SECRET = 'vfumnWSEhjrpECdSlXrV0PRK6DTsLuM23yexCT2Y';
const REFRESH_TOKEN = 'RT1-20-H0-1786068826v693ip5qs14kp1tfalp7';
const REALM_ID = '9341456470897772';

// === 2. UPDATE YOUR CHECKING ACCOUNT ID ===
const CHECKING_ID = "1150040038";

const oauthClient = new OAuthClient({
    clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, environment: 'sandbox', redirectUri: 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl'
});

oauthClient.getToken().setToken({ token_type: 'bearer', refresh_token: REFRESH_TOKEN, x_refresh_token_expires_in: 8726400, expires_in: 3600 });

// === 3. TARGET LEAF ACCOUNTS ===
const ACCTS = {
    // Admin
    CYBER_INS: "1150040087", DNO_INS: "1150040086", LIAB_INS: "1150040085", MGMT_FEE: "1150040088",
    GEN_DONATION: "1150040124", STUDENT_MEMBER: "1150040063",

    // Conference Rev
    CONF_DIAMOND: "1150040078", CONF_DONATION: "1150040082", CONF_EARLY: "1150040083", CONF_GOLD: "1150040079",
    CONF_PLATINUM: "1150040077", CONF_REG: "1150040081", CONF_SAPPHIRE: "1150040076", CONF_SILVER: "1150040080",

    // Conference Exp
    CONF_AV: "1150040119", CONF_STAFF: "1150040122", CONF_FOOD: "1150040121", CONF_HOTEL: "1150040117",
    CONF_SIGNS: "1150040120", CONF_SPEAKER: "1150040123", CONF_TRAVEL: "1150040116", CONF_VENUE: "1150040118",

    // Legacy Add-on Donations
    LUNCH_DONATION: "1150040060", GOLF_DONATION: "1150040061", GALA_DONATION: "1150040062",

    // Online Event Rev
    LL_VOL_DON: "1150040066", LL_VOL_REG: "1150040067", LL_CORP_DON: "1150040054", LL_CORP_REG: "1150040068",
    WEB_VOL_DON: "1150040072", WEB_VOL_REG: "1150040073", WEB_FUND_DON: "1150040053", WEB_FUND_REG: "1150040069",
    WEB_TAX_DON: "1150040059", WEB_TAX_REG: "1150040070",
    WS_DEI_DON: "1150040055", WS_DEI_REG: "1150040074", WS_FIN_DON: "1150040099", WS_FIN_REG: "1150040100",

    // Online Event Exp
    LL_VOL_TECH: "1150040095", LL_VOL_SPK: "1150040093", LL_VOL_LUNCH: "1150040094",
    LL_CORP_SPK: "1150040103", LL_CORP_LUNCH: "1150040104",
    WEB_VOL_GIFT: "1150040096", WEB_VOL_SPK: "1150040097", WEB_FUND_SPK: "1150040107",
    WEB_TAX_TECH: "1150040111", WEB_TAX_GIFT: "1150040110", WEB_TAX_SPK: "1150040109",
    WS_DEI_SPK: "1150040113", WS_DEI_VID: "1150040114"
};

// === 4. METADATA GENERATORS (DATA SCIENCE WORKAROUND) ===
const STATES = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'WA', 'AZ', 'CO', 'MA', 'VA'];
const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas'];
const VENDORS = ['TechFlow Solutions', 'Acme Corp', 'Global Dynamics', 'Summit Catering', 'City Center Venue', 'Apex Audio Visual', 'Pinnacle Print Shop', 'Elevate Management', 'SecureShield Insurance'];

function getRandomGeo() { return { state: STATES[rInt(0, STATES.length - 1)], zip: rInt(10000, 99999).toString() }; }
function getRandomPerson() { return `${FIRST_NAMES[rInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[rInt(0, LAST_NAMES.length - 1)]}`; }
function getRandomVendor() { return VENDORS[rInt(0, VENDORS.length - 1)]; }

// === HELPER FUNCTIONS ===
function formatDate(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function buildLine(type, date, amt, accId, memo) {
    let geo = getRandomGeo();
    let entity = type === 'Deposit' ? getRandomPerson() : getRandomVendor();

    // The Data Science metadata gets hidden in PrivateNote
    let privateNote = `Entity: ${entity} | Geo: ${geo.state}, ${geo.zip}`;

    let base = {
        "TxnDate": date,
        "PrivateNote": privateNote,
        "Line": [{ "Amount": amt, "Description": memo }] // The clean, user-facing memo
    };

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

// === 5. GENERATION ENGINE (10 YEARS) ===
let transactions = [];
console.log("Generating 10 years of narrative data...");

for (let year = 2016; year <= 2025; year++) {
    let yrOffset = year - 2016;

    // --- ADMIN & MEMBERSHIP ---
    let mgmtFee = 3000 + (yrOffset * 277);
    for (let m = 1; m <= 12; m++) {
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, m, 1), mgmtFee, ACCTS.MGMT_FEE, "AMC Monthly Retainer") });
    }
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 1, 15), 1500 + (yrOffset * 144), ACCTS.DNO_INS, "D&O Insurance Premium") });
    transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 3, 10), 1000 + (yrOffset * 105), ACCTS.LIAB_INS, "General Event Liability") });
    if (year >= 2019) transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 6, 5), 500 + ((year - 2019) * 116), ACCTS.CYBER_INS, "Cyber Security Insurance") });

    let stuCount = 20 + (yrOffset * 5);
    for (let i = 0; i < stuCount; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(1, 12), rInt(1, 28)), 15 + yrOffset, ACCTS.STUDENT_MEMBER, "Student Member Dues") }); }

    let donCount = 100 + (yrOffset * 33);
    for (let i = 0; i < donCount; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, rInt(1, 12), rInt(1, 28)), rInt(10, 50), ACCTS.GEN_DONATION, "General Micro-Donation") }); }

    // --- ANNUAL CONFERENCE ---
    if (year <= 2019 || year >= 2022) {
        let confReg = 195 + (yrOffset * 17); let confAtt = 150 + (yrOffset * 11);
        for (let i = 0; i < confAtt; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 8, rInt(1, 28)), confReg, ACCTS.CONF_REG, "Conf: Gen Registration") }); }
        for (let i = 0; i < 40; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 6, rInt(1, 28)), confReg - 25, ACCTS.CONF_EARLY, "Conf: Early Bird") }); }
        for (let i = 0; i < (confAtt * 0.3); i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 8, rInt(1, 28)), rInt(10, 30), ACCTS.CONF_DONATION, "Conf: Checkout Add-on") }); }

        for (let i = 0; i < 5; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 7, rInt(1, 28)), 5000, ACCTS.CONF_SILVER, "Conf: Silver Sponsor") }); }
        for (let i = 0; i < 4; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 7, rInt(1, 28)), 7500, ACCTS.CONF_GOLD, "Conf: Gold Sponsor") }); }
        if (year >= 2018) { for (let i = 0; i < 3; i++) transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 6, rInt(1, 28)), 10000, ACCTS.CONF_SAPPHIRE, "Conf: Sapphire Sponsor") }); }
        if (year >= 2022) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 5, 15), 25000, ACCTS.CONF_PLATINUM, "Conf: Platinum Title Sponsor") }); }
        if (year >= 2024) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 5, 10), 35000, ACCTS.CONF_DIAMOND, "Conf: Diamond Sponsor") }); }

        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 9, 5), 18000 + (yrOffset * 2222), ACCTS.CONF_VENUE, "Conf: Hotel/Venue Buyout") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 9, 10), 12000 + (yrOffset * 1833), ACCTS.CONF_FOOD, "Conf: Catering F&B") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 9, 1), 3000 + (yrOffset * 555), ACCTS.CONF_AV, "Conf: PSAV Production") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 8, 20), 1000 + (yrOffset * 200), ACCTS.CONF_SIGNS, "Conf: Print/Signage") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 9, 15), 1500 + (yrOffset * 188), ACCTS.CONF_TRAVEL, "Conf: Keynote Airfare") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 9, 15), 2000 + (yrOffset * 311), ACCTS.CONF_HOTEL, "Conf: Speaker/Staff Rooms") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 9, 15), 4000 + (yrOffset * 888), ACCTS.CONF_SPEAKER, "Conf: Speaker Honorariums") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 9, 15), 1000 + (yrOffset * 166), ACCTS.CONF_STAFF, "Conf: Temp Event Staff") });
    }

    // --- LEGACY EVENT DONATIONS ---
    if (year !== 2020) {
        for (let i = 0; i < 30; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 4, rInt(1, 28)), rInt(15, 50), ACCTS.LUNCH_DONATION, "Luncheon Add-on") }); }
        for (let i = 0; i < 25; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 6, rInt(1, 28)), rInt(10, 40), ACCTS.GOLF_DONATION, "Golf Add-on") }); }
        for (let i = 0; i < 45; i++) { transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 11, rInt(1, 28)), rInt(20, 75), ACCTS.GALA_DONATION, "Gala Add-on") }); }
    }

    // --- ONLINE EVENTS ---
    if (year >= 2020) {
        let webPrice = year === 2020 ? 0 : 15 + ((year - 2021) * 2);
        let llPrice = 10 + ((year - 2020) * 1);
        let wsPrice = 35 + ((year - 2020) * 3);
        let vol = year === 2020 || year === 2021 ? 200 : 130;

        if (webPrice > 0) {
            for (let i = 0; i < vol; i++) {
                transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 2, rInt(1, 28)), webPrice, ACCTS.WEB_TAX_REG, "Webinar: Tax Comp") });
                transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 5, rInt(1, 28)), webPrice, ACCTS.WEB_FUND_REG, "Webinar: Fundraising") });
                transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 8, rInt(1, 28)), webPrice, ACCTS.WEB_VOL_REG, "Webinar: Vol Mgmt") });
            }
        }
        for (let i = 0; i < (vol * 0.2); i++) {
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 2, rInt(1, 28)), rInt(5, 20), ACCTS.WEB_TAX_DON, "Webinar Donation") });
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 5, rInt(1, 28)), rInt(5, 20), ACCTS.WEB_FUND_DON, "Webinar Donation") });
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 8, rInt(1, 28)), rInt(5, 20), ACCTS.WEB_VOL_DON, "Webinar Donation") });
        }
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 2, 10), 100, ACCTS.WEB_TAX_TECH, "Zoom Add-on") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 2, 15), 350, ACCTS.WEB_TAX_SPK, "Webinar Speaker") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 2, 15), 50, ACCTS.WEB_TAX_GIFT, "Speaker Gift") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 5, 15), 350, ACCTS.WEB_FUND_SPK, "Webinar Speaker") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 8, 15), 350, ACCTS.WEB_VOL_SPK, "Webinar Speaker") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 8, 15), 50, ACCTS.WEB_VOL_GIFT, "Speaker Gift") });

        for (let i = 0; i < 80; i++) {
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 4, rInt(1, 28)), llPrice, ACCTS.LL_VOL_REG, "L&L: Vol Retention") });
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 10, rInt(1, 28)), llPrice, ACCTS.LL_CORP_REG, "L&L: Corp Partners") });
        }
        for (let i = 0; i < 15; i++) {
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 4, rInt(1, 28)), rInt(5, 15), ACCTS.LL_VOL_DON, "L&L Donation") });
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 10, rInt(1, 28)), rInt(5, 15), ACCTS.LL_CORP_DON, "L&L Donation") });
        }
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 4, 10), 50, ACCTS.LL_VOL_TECH, "Captioning Services") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 4, 15), 250, ACCTS.LL_VOL_SPK, "L&L Speaker") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 4, 15), 200, ACCTS.LL_VOL_LUNCH, "UberEats for Staff") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 10, 15), 250, ACCTS.LL_CORP_SPK, "L&L Speaker") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 10, 15), 200, ACCTS.LL_CORP_LUNCH, "UberEats for Staff") });

        for (let i = 0; i < 50; i++) {
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 7, rInt(1, 28)), wsPrice, ACCTS.WS_DEI_REG, "Workshop: DEI") });
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 11, rInt(1, 28)), wsPrice, ACCTS.WS_FIN_REG, "Workshop: Financial") });
        }
        for (let i = 0; i < 10; i++) {
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 7, rInt(1, 28)), rInt(10, 30), ACCTS.WS_DEI_DON, "Workshop Donation") });
            transactions.push({ type: "Deposit", payload: buildLine('Deposit', formatDate(year, 11, rInt(1, 28)), rInt(10, 30), ACCTS.WS_FIN_DON, "Workshop Donation") });
        }
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 7, 15), 500 + ((year - 2020) * 150), ACCTS.WS_DEI_SPK, "Workshop Facilitator") });
        transactions.push({ type: "Purchase", payload: buildLine('Purchase', formatDate(year, 7, 15), 450, ACCTS.WS_DEI_VID, "Post-Event Video Edit") });
    }
}

// === 6. BATCH UPLOAD ===
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
    console.log("\n🚀 NARRATIVE SEED DATA INJECTED SUCCESSFULLY!");
}).catch(e => { console.error("ERROR REFRESHING TOKEN:", e); });
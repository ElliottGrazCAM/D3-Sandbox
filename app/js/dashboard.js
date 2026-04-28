let globalData = null;
let currentEventType = 'Conference'; // Tracks which event is currently open
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// Load the data ONCE when the page opens
d3.json("data.json").then(data => {
    globalData = data;

    // Set default dropdown value to Prior Year automatically on load
    const defaultYear = new Date().getFullYear() - 1;
    document.getElementById("year-select").value = defaultYear;

    const urlParams = new URLSearchParams(window.location.search);
    currentEventType = urlParams.get('event') || 'Conference';

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${currentEventType.toLowerCase()}`);
    if (activeNav) activeNav.classList.add('active');

    renderEvent(currentEventType);
}).catch(error => {
    console.error("CRITICAL ERROR: Failed to load or parse data.json", error);
});

// Sidebar & Tab Click Handler
window.switchEvent = function (eventType, element) {
    currentEventType = eventType;

    // 1. Remove the "active" class from all tabs
    const tabs = element.parentElement.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // 2. Add the "active" class strictly to the clicked tab
    element.classList.add('active');

    // 3. Render the new data
    renderEvent(eventType);
};

// Dropdown Change Handler
window.changeYear = function () {
    renderEvent(currentEventType); // Redraw charts with the new year!
};

// ==========================================
// MASTER RENDER FUNCTION (EVENTS ONLY)
// ==========================================
function renderEvent(eventType) {
    if (!globalData) return;

    // READ THE DYNAMIC YEAR DIRECTLY FROM THE DROPDOWN!
    const TARGET_YEAR = parseInt(document.getElementById("year-select").value);

    let title = "";
    let REV_PARENT = "";
    let EXP_PARENT = "";
    let startDate, endDate;

    if (eventType === "Luncheon") {
        title = "Annual Luncheon";
        REV_PARENT = "Events and Programs:Annual Luncheon Revenue";
        EXP_PARENT = "Events and Program Expenses:Annual Luncheon Expenses";
        startDate = new Date(TARGET_YEAR, 1, 1);
        endDate = new Date(TARGET_YEAR, 11, 31);
    } else if (eventType === "Gala") {
        title = "Winter Gala";
        REV_PARENT = "Events and Programs:Winter Gala Revenue";
        EXP_PARENT = "Events and Program Expenses:Winter Gala Expenses";
        startDate = new Date(TARGET_YEAR, 8, 1);
        endDate = new Date(TARGET_YEAR + 1, 1, 28);
    } else if (eventType === "Golf") {
        title = "Golf Tournament";
        REV_PARENT = "Events and Programs:Golf Tournament Revenue";
        EXP_PARENT = "Events and Program Expenses:Golf Tournament Expenses";
        startDate = new Date(TARGET_YEAR - 1, 11, 1);
        endDate = new Date(TARGET_YEAR, 7, 31);
    } else if (eventType === "Conference") {
        // NEW: Annual Conference
        title = "Annual Conference";
        REV_PARENT = "Events and Programs:Annual Conference Revenue";
        EXP_PARENT = "Events and Program Expenses:Annual Conference Expenses";
        // Registration starts in May, event wraps up in October
        startDate = new Date(TARGET_YEAR, 4, 1);
        endDate = new Date(TARGET_YEAR, 10, 31);
    } else if (eventType === "Online") {
        // NEW: Online Events
        title = "Digital Programming";
        REV_PARENT = "Online Events";
        EXP_PARENT = "Online Event Expenses";
        // Online programming happens year-round
        startDate = new Date(TARGET_YEAR, 0, 1);
        endDate = new Date(TARGET_YEAR, 11, 31);
    }

    document.getElementById("event-title-display").innerText = title;

    // DYNAMIC EXPLAINER TEXT FOR EVENTS
    const explainerHtml = `
        <ul>
            <li><strong>Target Year:</strong> ${TARGET_YEAR}</li>
            <li><strong>Date Window:</strong> Pulls transactions specifically dated between <b>${startDate.toLocaleDateString()}</b> and <b>${endDate.toLocaleDateString()}</b> to capture early/late checks.</li>
            <li><strong>Revenue Filter:</strong> Requires QuickBooks accounts to begin exactly with <code>"${REV_PARENT}"</code>.</li>
            <li><strong>Expense Filter:</strong> Requires QuickBooks accounts to begin exactly with <code>"${EXP_PARENT}"</code>.</li>
            <li><strong>Budgets:</strong> Pulls the ${TARGET_YEAR} Master Budget directly assigned to these specific accounts.</li>
        </ul>
    `;
    const explainerText = document.getElementById("explainer-text");
    if (explainerText) explainerText.innerHTML = explainerHtml;

    const revBuckets = {};
    const expBuckets = {};
    let totalRev = 0; let totalExp = 0;
    let totalRevBudget = 0; let totalExpBudget = 0;

    function initBucket(obj, name, id) {
        if (!obj[name]) obj[name] = { name: name, id: id, total: 0, budget: 0, txns: [] };
    }

    // === MISSING FUNCTION RESTORED HERE ===
    function processTransactions(records, isExpense, bucketsObj, parentFilter) {
        if (!records) return;
        records.forEach(record => {
            const txnDate = new Date(record.TxnDate);

            if (txnDate >= startDate && txnDate <= endDate) {
                if (!record.Line) return;

                record.Line.forEach(line => {
                    const amt = line.Amount;
                    if (!amt || amt === 0) return;

                    let acctName = "";
                    let acctId = "";

                    if (isExpense && line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail.AccountRef) {
                        acctName = line.AccountBasedExpenseLineDetail.AccountRef.name || "";
                        acctId = line.AccountBasedExpenseLineDetail.AccountRef.value || "";
                    } else if (!isExpense && line.DetailType === "DepositLineDetail" && line.DepositLineDetail.AccountRef) {
                        acctName = line.DepositLineDetail.AccountRef.name || "";
                        acctId = line.DepositLineDetail.AccountRef.value || "";
                    }

                    if (acctName.startsWith(parentFilter)) {
                        const shortName = acctName.split(':').pop();
                        initBucket(bucketsObj, shortName, acctId);
                        bucketsObj[shortName].total += amt;

                        let desc = line.Description || (record.EntityRef ? record.EntityRef.name : "Online Transaction");
                        bucketsObj[shortName].txns.push({ date: record.TxnDate, desc: desc, amount: amt });

                        if (isExpense) totalExp += amt;
                        else totalRev += amt;
                    }
                });
            }
        });
    }

    processTransactions(globalData.Deposits, false, revBuckets, REV_PARENT);
    processTransactions(globalData.Expenses, true, expBuckets, EXP_PARENT);

    if (globalData.Budgets && globalData.Budgets.length > 0) {
        const targetBudget = globalData.Budgets.find(b =>
            (b.Name && b.Name.includes(TARGET_YEAR.toString())) ||
            (b.StartDate && b.StartDate.startsWith(TARGET_YEAR.toString()))
        );

        const budgetLines = (targetBudget && targetBudget.BudgetDetail) ? targetBudget.BudgetDetail : [];

        budgetLines.forEach(item => {
            const accName = item.AccountRef ? item.AccountRef.name : "";
            const accId = item.AccountRef ? item.AccountRef.value : "";
            const bDate = item.BudgetDate ? new Date(item.BudgetDate) : null;
            const amt = parseFloat(item.Amount || 0);

            if (bDate && bDate.getFullYear() === TARGET_YEAR && amt !== 0) {
                if (accName.startsWith(REV_PARENT)) {
                    const shortName = accName.split(':').pop();
                    initBucket(revBuckets, shortName, accId);
                    revBuckets[shortName].budget += amt;
                    totalRevBudget += amt;
                } else if (accName.startsWith(EXP_PARENT)) {
                    const shortName = accName.split(':').pop();
                    initBucket(expBuckets, shortName, accId);
                    expBuckets[shortName].budget += amt;
                    totalExpBudget += amt;
                }
            }
        });
    }

    const sortedRev = Object.values(revBuckets).sort((a, b) => b.total - a.total);
    const sortedExp = Object.values(expBuckets).sort((a, b) => b.total - a.total);

    // Dynamically count ALL transactions in any account containing "Registration"
    const numRegistrants = Object.values(revBuckets)
        .filter(bucket => bucket.name.toLowerCase().includes("registration"))
        .reduce((sum, bucket) => sum + bucket.txns.length, 0);

    // Dynamically count ALL transactions in any account containing "Sponsor"
    const numSponsors = Object.values(revBuckets)
        .filter(bucket => bucket.name.toLowerCase().includes("sponsor"))
        .reduce((sum, bucket) => sum + bucket.txns.length, 0);
    const netRev = totalRev - totalExp;

    if (document.getElementById("kpi-registrants")) d3.select("#kpi-registrants").text(numRegistrants);
    if (document.getElementById("kpi-sponsors")) d3.select("#kpi-sponsors").text(numSponsors);
    if (document.getElementById("kpi-net")) {
        d3.select("#kpi-net")
            .text(netRev < 0 ? `-$${Math.abs(netRev).toLocaleString()}` : `$${netRev.toLocaleString()}`)
            .style("color", netRev < 0 ? "#ef4444" : "#10b981");
    }

    // CHART 1: NET PERFORMANCE
    d3.select("#chart-net-performance").html("");
    if (sortedRev.length > 0 || sortedExp.length > 0) {
        const marginNet = { top: 10, right: 20, bottom: 10, left: 50 }, widthNet = 800 - marginNet.left - marginNet.right, heightNet = 400 - marginNet.top - marginNet.bottom;
        const svgNet = d3.select("#chart-net-performance").append("svg").attr("viewBox", `0 0 ${widthNet + marginNet.left + marginNet.right} ${heightNet + marginNet.top + marginNet.bottom}`).attr("width", "100%").attr("height", "100%").attr("preserveAspectRatio", "xMidYMid meet").append("g").attr("transform", `translate(${marginNet.left},${marginNet.top})`);
        const xNet = d3.scaleBand().domain(["Total Revenue", "Total Expenses"]).range([0, widthNet]).padding(0.4);
        const maxVal = Math.max(totalRev, totalExp, totalRevBudget, totalExpBudget) * 1.1 || 1;
        const yNet = d3.scaleLinear().domain([0, maxVal]).range([heightNet, 0]);

        svgNet.append("g").attr("transform", `translate(0,${heightNet})`).call(d3.axisBottom(xNet).tickSizeOuter(0)).selectAll("text").style("font-size", "14px").style("font-weight", "bold");
        svgNet.append("g").attr("class", "grid").call(d3.axisLeft(yNet).tickSize(-widthNet).tickFormat(d => "$" + d.toLocaleString()).ticks(5)).style("stroke-dasharray", "3,3").style("opacity", 0.1);
        svgNet.select(".domain").remove();

        const netData = [{ label: "Total Revenue", actual: totalRev, budget: totalRevBudget, type: "rev" }, { label: "Total Expenses", actual: totalExp, budget: totalExpBudget, type: "exp" }];

        svgNet.selectAll(".bg-bar").data(netData).enter().append("rect").attr("x", d => xNet(d.label) - 10).attr("y", d => yNet(d.budget)).attr("width", xNet.bandwidth() + 20).attr("height", d => heightNet - yNet(d.budget)).attr("fill", d => d.type === "rev" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)").attr("rx", 4);
        svgNet.selectAll(".fg-bar").data(netData).enter().append("rect").attr("x", d => xNet(d.label)).attr("y", d => yNet(d.actual)).attr("width", xNet.bandwidth()).attr("height", d => heightNet - yNet(d.actual))
            .attr("fill", d => { if (d.type === "rev") return d.actual > d.budget ? "#10b981" : "#065f46"; else return d.actual > d.budget ? "#991b1b" : "#ef4444"; }).attr("rx", 4)
            .on("mouseover", function (event, d) {
                d3.select(this).style("opacity", 0.8); tooltip.transition().duration(200).style("opacity", 1);
                const diff = d.actual - d.budget; const diffText = diff > 0 ? `+$${diff.toLocaleString()}` : `-$${Math.abs(diff).toLocaleString()}`;
                tooltip.html(`<div style="font-weight:bold; font-size:14px; margin-bottom:4px;">${d.label}</div><div>Actual: <b>$${d.actual.toLocaleString()}</b></div><div>Budget: <b style="color:#cbd5e1">$${d.budget.toLocaleString()}</b></div><div style="font-size: 12px; margin-top:4px; color:#94a3b8;">Variance: ${diffText}</div>`).style("left", () => (event.pageX + 15 + tooltip.node().offsetWidth > window.innerWidth - 20) ? (event.pageX - tooltip.node().offsetWidth - 15) + "px" : (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            }).on("mouseout", function () { d3.select(this).style("opacity", 1); tooltip.transition().duration(500).style("opacity", 0); });
        svgNet.selectAll(".target-line").data(netData).enter().append("line").attr("x1", d => xNet(d.label) - 15).attr("x2", d => xNet(d.label) + xNet.bandwidth() + 15).attr("y1", d => yNet(d.budget)).attr("y2", d => yNet(d.budget)).attr("stroke", "#f8fafc").attr("stroke-width", 2).attr("stroke-dasharray", "4,2");
    }

    // CHART 1.5: ACCOUNT LEVEL ACTUALS 
    d3.select("#chart-budget-actuals").html("");
    const combinedData = [...sortedRev.map(d => ({ ...d, type: 'Rev' })), ...sortedExp.map(d => ({ ...d, type: 'Exp' }))];
    if (combinedData.length > 0) {

        // FIX 1: Shrank the base width from 800 to 500 (perfect for half-page cards)
        // Also tightened the left margin slightly to give the bars more room to breathe
        const marginAcc = { top: 10, right: 30, bottom: 10, left: 110 };
        const widthAcc = 500 - marginAcc.left - marginAcc.right;
        const heightAcc = Math.max((combinedData.length * 50), 350); // Kept your brilliant dynamic height logic!

        // FIX 2: Swapped attr("height", "100%") to style("height", "auto")
        const svgAcc = d3.select("#chart-budget-actuals").append("svg")
            .attr("viewBox", `0 0 ${widthAcc + marginAcc.left + marginAcc.right} ${heightAcc + marginAcc.top + marginAcc.bottom}`)
            .attr("width", "100%")
            .style("height", "auto") // CRITICAL FIX: lets the box shrink-wrap the chart
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g").attr("transform", `translate(${marginAcc.left},${marginAcc.top})`);

        const yAcc = d3.scaleBand().domain(combinedData.map(d => d.name)).range([0, heightAcc]).padding(0.4);
        const maxAccVal = d3.max(combinedData, d => Math.max(d.total, d.budget)) * 1.1 || 1;
        const xAcc = d3.scaleLinear().domain([0, maxAccVal]).range([0, widthAcc]);

        svgAcc.append("g").call(d3.axisLeft(yAcc).tickSize(0)).selectAll("text").style("font-size", "12px").style("fill", "#cbd5e1");
        svgAcc.select(".domain").remove();

        svgAcc.selectAll(".bg-acc").data(combinedData).enter().append("rect").attr("y", d => yAcc(d.name) - 4).attr("x", 0).attr("height", yAcc.bandwidth() + 8).attr("width", d => xAcc(d.budget)).attr("fill", d => d.type === 'Rev' ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)").attr("rx", 2);

        svgAcc.selectAll(".fg-acc").data(combinedData).enter().append("rect").attr("y", d => yAcc(d.name)).attr("x", 0).attr("height", yAcc.bandwidth()).attr("width", d => xAcc(d.total))
            .attr("fill", d => { if (d.type === 'Rev') return d.total > d.budget ? "#10b981" : "#065f46"; else return d.total > d.budget ? "#991b1b" : "#ef4444"; }).attr("rx", 2)
            .on("mouseover", function (event, d) {
                d3.select(this).style("opacity", 0.8); tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`<div style="font-weight:bold; font-size:14px; margin-bottom:4px;">${d.name}</div><div>Actual: <b>$${d.total.toLocaleString()}</b></div><div>Budget: <b style="color:#cbd5e1">$${d.budget.toLocaleString()}</b></div>`).style("left", () => (event.pageX + 15 + tooltip.node().offsetWidth > window.innerWidth - 20) ? (event.pageX - tooltip.node().offsetWidth - 15) + "px" : (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            }).on("mouseout", function () { d3.select(this).style("opacity", 1); tooltip.transition().duration(500).style("opacity", 0); });

        svgAcc.selectAll(".target-line-acc").data(combinedData).enter().append("line").attr("y1", d => yAcc(d.name) - 6).attr("y2", d => yAcc(d.name) + yAcc.bandwidth() + 6).attr("x1", d => xAcc(d.budget)).attr("x2", d => xAcc(d.budget)).attr("stroke", "#f8fafc").attr("stroke-width", 2).attr("stroke-dasharray", "3,2");
    }

    // CHARTS 2 & 3: COMPOSITION BARS
    function drawCompositionChart(containerId, sortedData, totalAmount, colorScale, isExp) {
        const container = d3.select(containerId);
        container.html(""); // Clear old data

        if (sortedData.length === 0) return;

        // FORCE VERTICAL STACKING: This overrides any background CSS trying to make it a row
        container.style("height", "auto")
            .style("padding-bottom", "15px")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("align-items", "center");

        const compHeight = 60, widthComp = 900;

        // Dynamic width, but we apply a max-height so the bar stays sleek
        const svgComp = container.append("svg")
            .attr("viewBox", `0 0 ${widthComp} ${compHeight}`)
            .attr("width", "100%")
            .style("height", "auto")
            .style("max-height", "80px")
            .style("display", "block");

        const xComp = d3.scaleLinear().domain([0, totalAmount || 1]).range([0, widthComp]);
        let currentX = 0;

        // Loop 1: Draw the SVG chart
        sortedData.forEach((bucket, i) => {
            const segWidth = xComp(bucket.total);
            const g = svgComp.append("g").attr("transform", `translate(${currentX}, 0)`);

            g.append("rect").attr("width", segWidth).attr("height", compHeight)
                .attr("fill", colorScale(i))
                .attr("stroke", "#0f172a").attr("stroke-width", 2).style("cursor", "pointer")
                .on("mouseover", (event) => showTooltip(event, bucket, isExp, totalAmount))
                .on("mouseout", hideTooltip)
                .on("click", () => filterByAccount(isExp ? 'exp-table' : 'rev-table', bucket.name, isExp));

            // Pure black text for the slice labels
            if (segWidth > 80) {
                g.append("text").attr("x", segWidth / 2).attr("y", compHeight / 2).attr("dy", ".35em")
                    .style("text-anchor", "middle")
                    .style("fill", "#000000") // Forces absolute black text
                    .style("font-size", "12px")
                    .style("font-weight", "700")
                    .style("pointer-events", "none")
                    .text(bucket.name);
            }

            currentX += segWidth;
        });

        // The Legend Container
        const legendContainer = container.append("div")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("gap", "12px")
            .style("margin-top", "15px")
            .style("justify-content", "center")
            .style("width", "100%");

        // Loop 2: Generate the legend items
        sortedData.forEach((bucket, i) => {
            const legendItem = legendContainer.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("font-size", "12px")
                .style("color", "#94a3b8");

            legendItem.append("div")
                .style("width", "12px")
                .style("height", "12px")
                .style("background-color", colorScale(i))
                .style("border", "1px solid #0f172a")
                .style("margin-right", "6px")
                .style("border-radius", "2px");

            legendItem.append("span").text(bucket.name);
        });
    }

    // Call the functions ONCE
    drawCompositionChart("#chart-rev-composition", sortedRev, totalRev,
        (i) => d3.interpolateGreens(1 - (i / Math.max(sortedRev.length, 2)) * 0.6), false);

    drawCompositionChart("#chart-exp-composition", sortedExp, totalExp,
        (i) => d3.interpolateReds(1 - (i / Math.max(sortedExp.length, 2)) * 0.6), true);

    function showTooltip(event, bucket, isExp, grandTotal) {
        d3.select(event.currentTarget).style("opacity", 0.7);
        tooltip.transition().duration(200).style("opacity", 1);

        const percent = grandTotal ? ((bucket.total / grandTotal) * 100).toFixed(1) : 0;
        const txnCount = bucket.txns.length;
        const avgAmt = txnCount ? (bucket.total / txnCount) : 0;

        // Header Section
        let innerHtml = `<div style="border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 8px;"><span style="color:${isExp ? '#ef4444' : '#10b981'}; font-weight:bold; font-size: 14px;">${bucket.name.toUpperCase()}</span><br><span style="color:#f8fafc; font-size: 18px; font-weight: 700;">$${bucket.total.toLocaleString()} Total</span></div><div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px; border-bottom: 1px dashed #475569; padding-bottom: 8px;"><span style="color:#94a3b8;">Share of Total:</span> <span style="color:#f8fafc; font-weight:bold;">${percent}%</span></div>`;

        // Statistical Data Section
        if (isExp) {
            innerHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;"><span style="color:#94a3b8;">Total Expenses:</span> <span style="color:#f8fafc; font-weight:bold;">${txnCount}</span></div><div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:#94a3b8;">Average Expense: </span> <span style="color:#f8fafc; font-weight:bold;">$${avgAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
        } else {
            innerHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;"><span style="color:#94a3b8;">Total Contributions:</span> <span style="color:#f8fafc; font-weight:bold;">${txnCount}</span></div><div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:#94a3b8;">Average Amount: </span> <span style="color:#f8fafc; font-weight:bold;">$${avgAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
        }

        // Smart screen edge detection
        tooltip.html(innerHtml)
            .style("left", () => (event.pageX + 15 + tooltip.node().offsetWidth > window.innerWidth - 20) ? (event.pageX - tooltip.node().offsetWidth - 15) + "px" : (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip(event) {
        d3.select(event.currentTarget).style("opacity", 1);
        tooltip.transition().duration(500).style("opacity", 0);
    }

    function populateTable(tbodyId, buckets, isExp) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = "";
        let allTxns = [];

        Object.values(buckets).forEach(b => b.txns.forEach(t => allTxns.push({ ...t, account: b.name })));
        allTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

        allTxns.forEach(t => {
            const tr = document.createElement("tr");
            tr.setAttribute("data-account", t.account);
            tr.innerHTML = `<td>${t.date}</td><td><strong>${t.desc}</strong></td><td><span class="badge ${isExp ? 'expense' : 'sponsor'}">${t.account}</span></td><td style="font-family: monospace; font-size:14px; color:${isExp ? '#ef4444' : '#10b981'};">$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>`;
            tbody.appendChild(tr);
        });
    }

    populateTable("rev-tbody", revBuckets, false);
    populateTable("exp-tbody", expBuckets, true);

    window.resetFilters('rev-table');
    window.resetFilters('exp-table');

    // YOY CHARTS
    const yoyYears = [TARGET_YEAR - 2, TARGET_YEAR - 1, TARGET_YEAR];
    const colorScaleYoY = d3.scaleOrdinal().domain(yoyYears).range(["#475569", "#3b82f6", "#f59e0b"]);

    function processYoYData(records, parentFilter, isExpense) {
        const yoyBuckets = {};
        if (records) {
            records.forEach(record => {
                const year = new Date(record.TxnDate).getFullYear();
                if (yoyYears.includes(year)) {
                    if (!record.Line) return;
                    record.Line.forEach(line => {
                        const amt = line.Amount;
                        if (!amt || amt === 0) return;
                        let acctName = "";
                        if (isExpense && line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail.AccountRef) { acctName = line.AccountBasedExpenseLineDetail.AccountRef.name || ""; } else if (!isExpense && line.DetailType === "DepositLineDetail" && line.DepositLineDetail.AccountRef) { acctName = line.DepositLineDetail.AccountRef.name || ""; }
                        if (acctName.startsWith(parentFilter)) {
                            const shortName = acctName.split(':').pop();
                            if (!yoyBuckets[shortName]) { yoyBuckets[shortName] = { account: shortName }; yoyYears.forEach(y => yoyBuckets[shortName][y] = 0); }
                            yoyBuckets[shortName][year] += amt;
                        }
                    });
                }
            });
        }
        return Object.values(yoyBuckets).sort((a, b) => a.account.localeCompare(b.account));
    }

    const yoyRevData = processYoYData(globalData.Deposits, REV_PARENT, false);
    const yoyExpData = processYoYData(globalData.Expenses, EXP_PARENT, true);

    function drawYoYChart(containerId, chartData) {
        d3.select(containerId).html("");
        if (chartData.length === 0) return;

        // Gives each account 80px of breathing room, or defaults to 800px minimum
        const dynamicWidth = Math.max((chartData.length * 80), 800);

        const margin = { top: 40, right: 30, bottom: 110, left: 60 };
        const width = dynamicWidth - margin.left - margin.right;
        const height = 320 - margin.top - margin.bottom;

        const svg = d3.select(containerId).append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("width", "100%")
            .style("height", "auto") // Keep this! It lets the box shrink-wrap the chart.
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x0 = d3.scaleBand().domain(chartData.map(d => d.account)).range([0, width]).padding(0.2);
        const x1 = d3.scaleBand().domain(yoyYears).range([0, x0.bandwidth()]).padding(0.05);
        const maxVal = d3.max(chartData, d => d3.max(yoyYears, y => d[y])) * 1.1 || 1;
        const y = d3.scaleLinear().domain([0, maxVal]).range([height, 0]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0)).selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-45)").style("font-size", "12px").style("fill", "#cbd5e1");
        svg.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + d.toLocaleString()).tickSize(-width)).style("stroke-dasharray", "3,3").style("opacity", 0.1);
        svg.select(".domain").remove();

        const accountGroup = svg.selectAll(".acc-group").data(chartData).enter().append("g").attr("transform", d => `translate(${x0(d.account)},0)`);
        accountGroup.selectAll("rect").data(d => yoyYears.map(year => ({ year: year, value: d[year], fullData: d })))
            .enter().append("rect").attr("x", d => x1(d.year)).attr("y", d => y(d.value)).attr("width", x1.bandwidth()).attr("height", d => height - y(d.value)).attr("fill", d => colorScaleYoY(d.year)).attr("rx", 2)
            .on("mouseover", function (event, d) {
                d3.select(this).style("opacity", 0.8); tooltip.transition().duration(200).style("opacity", 1);
                let percentHtml = "";
                if (d.year === TARGET_YEAR - 1) {
                    const prevVal = d.fullData[TARGET_YEAR - 2];
                    if (prevVal > 0) { const pct = (((d.value - prevVal) / prevVal) * 100).toFixed(1); const color = pct >= 0 ? "#10b981" : "#ef4444"; percentHtml += `<div style="font-size:12px; margin-top:4px;">Vs Previous Year: <span style="color:${color}; font-weight:bold;">${pct > 0 ? '+' : ''}${pct}%</span></div>`; }
                } else if (d.year === TARGET_YEAR) {
                    const prev1 = d.fullData[TARGET_YEAR - 1]; const prev2 = d.fullData[TARGET_YEAR - 2];
                    if (prev1 > 0) { const pct1 = (((d.value - prev1) / prev1) * 100).toFixed(1); const c1 = pct1 >= 0 ? "#10b981" : "#ef4444"; percentHtml += `<div style="font-size:12px; margin-top:4px;">Vs Previous Year: <span style="color:${c1}; font-weight:bold;">${pct1 > 0 ? '+' : ''}${pct1}%</span></div>`; }
                    if (prev2 > 0) { const pct2 = (((d.value - prev2) / prev2) * 100).toFixed(1); const c2 = pct2 >= 0 ? "#10b981" : "#ef4444"; percentHtml += `<div style="font-size:12px;">Vs Year Prior (2 Yr): <span style="color:${c2}; font-weight:bold;">${pct2 > 0 ? '+' : ''}${pct2}%</span></div>`; }
                }
                tooltip.html(`<div style="font-weight:bold; font-size:14px; margin-bottom:4px; color:${colorScaleYoY(d.year)}">${d.fullData.account} (${d.year})</div><div style="font-size: 16px;">Total: <b>$${d.value.toLocaleString()}</b></div>${percentHtml}`).style("left", () => (event.pageX + 15 + tooltip.node().offsetWidth > window.innerWidth - 20) ? (event.pageX - tooltip.node().offsetWidth - 15) + "px" : (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            }).on("mouseout", function () { d3.select(this).style("opacity", 1); tooltip.transition().duration(500).style("opacity", 0); });

        const legend = svg.append("g").attr("transform", `translate(${width - 250}, -20)`);
        yoyYears.forEach((year, i) => {
            const legendRow = legend.append("g").attr("transform", `translate(${i * 80}, 0)`);
            legendRow.append("rect").attr("width", 12).attr("height", 12).attr("fill", colorScaleYoY(year)).attr("rx", 2);
            legendRow.append("text").attr("x", 18).attr("y", 10).text(year).style("font-size", "12px").style("fill", "#cbd5e1");
        });
    }

    drawYoYChart("#chart-yoy-rev", yoyRevData);
    drawYoYChart("#chart-yoy-exp", yoyExpData);
}

// UI TABLE INTERACTIONS
let activeRevFilter = null; let activeExpFilter = null;
window.filterByAccount = function (tableId, accountName, isExp) {
    if (isExp) { activeExpFilter = (activeExpFilter === accountName) ? null : accountName; accountName = activeExpFilter; document.getElementById('exp-search').value = ""; } else { activeRevFilter = (activeRevFilter === accountName) ? null : accountName; accountName = activeRevFilter; document.getElementById('rev-search').value = ""; }
    const tbody = document.getElementById(tableId).querySelector("tbody");
    if (tbody) { const rows = tbody.getElementsByTagName("tr"); for (let row of rows) { row.style.display = (!accountName || row.getAttribute("data-account") === accountName) ? "" : "none"; } }
};
window.searchTable = function (tableId, query) {
    query = query.toLowerCase();
    if (tableId === 'rev-table') activeRevFilter = null; if (tableId === 'exp-table') activeExpFilter = null;
    const tbody = document.getElementById(tableId).querySelector("tbody");
    if (tbody) { const rows = tbody.getElementsByTagName("tr"); for (let row of rows) row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none"; }
};
window.resetFilters = function (tableId) {
    if (tableId === 'rev-table') { activeRevFilter = null; const si = document.getElementById('rev-search'); if (si) si.value = ""; } else { activeExpFilter = null; const si = document.getElementById('exp-search'); if (si) si.value = ""; }
    const tbody = document.getElementById(tableId); if (tbody) { const rows = tbody.querySelectorAll("tbody tr"); for (let row of rows) row.style.display = ""; }
};
let sortDirs = { 'rev-table': false, 'exp-table': false };
window.sortTable = function (tableId, columnIndex) {
    const table = document.getElementById(tableId); if (!table) return;
    const tbody = table.querySelector("tbody"); const rows = Array.from(tbody.rows);
    sortDirs[tableId] = !sortDirs[tableId]; const isAscending = sortDirs[tableId];
    rows.sort((a, b) => { let cellA = a.cells[columnIndex].innerText.replace(/[^0-9a-zA-Z.-]+/g, ""); let cellB = b.cells[columnIndex].innerText.replace(/[^0-9a-zA-Z.-]+/g, ""); if (!isNaN(cellA) && !isNaN(cellB)) return isAscending ? cellA - cellB : cellB - cellA; return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA); });
    rows.forEach(row => tbody.appendChild(row));
};
window.toggleLedger = function (containerId, btnElement) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Find the text span inside the button we clicked
    const textSpan = btnElement.querySelector('span');

    if (container.style.display === "none") {
        container.style.display = "block";
        textSpan.innerText = "Hide Transaction Ledger"; // Updates text, leaves SVG alone
    } else {
        container.style.display = "none";
        textSpan.innerText = "Show Transaction Ledger"; // Updates text, leaves SVG alone
    }
};
window.toggleExplainer = function () {
    const el = document.getElementById("data-explainer");
    el.style.display = el.style.display === "none" || el.style.display === "" ? "block" : "none";
};
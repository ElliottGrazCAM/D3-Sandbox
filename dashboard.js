d3.json("data.json").then(data => {

    // ==========================================
    // THE HIERARCHY FILTER: DYNAMIC & ACCURATE
    // ==========================================
    const LUNCHEON_REV_PARENT = "Events and Programs:Annual Luncheon Revenue";
    const LUNCHEON_EXP_PARENT = "Events and Program Expenses:Annual Luncheon Expenses";

    const luncheonDeposits = [];
    const luncheonExpenses = [];

    if (data.Deposits) {
        data.Deposits.forEach(record => {
            let recordHasLuncheon = false;
            const validLines = [];
            record.Line.forEach(line => {
                if (line.Amount && line.DetailType === "DepositLineDetail" && line.DepositLineDetail.AccountRef) {
                    const accountName = line.DepositLineDetail.AccountRef.name || "";
                    if (accountName.startsWith(LUNCHEON_REV_PARENT)) {
                        recordHasLuncheon = true;
                        validLines.push(line);
                    }
                }
            });
            if (recordHasLuncheon) luncheonDeposits.push({ ...record, Line: validLines });
        });
    }

    if (data.Expenses) {
        data.Expenses.forEach(record => {
            let recordHasLuncheon = false;
            record.Line.forEach(line => {
                if (line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail.AccountRef) {
                    const accountName = line.AccountBasedExpenseLineDetail.AccountRef.name || "";
                    if (accountName.startsWith(LUNCHEON_EXP_PARENT)) recordHasLuncheon = true;
                }
            });
            if (recordHasLuncheon) luncheonExpenses.push(record);
        });
    }

    // ==========================================
    // DATA AGGREGATION & DYNAMIC YEAR SETUP
    // ==========================================
    const CURRENT_YEAR = new Date().getFullYear(); // 2026
    const TARGET_YEAR = CURRENT_YEAR - 1; // Evaluates to 2025

    // Update the UI Titles dynamically based on the target year
    document.querySelectorAll("h3").forEach(h3 => {
        if (h3.innerText.includes("2025")) {
            h3.innerText = h3.innerText.replace("2025", TARGET_YEAR);
        }
    });

    const EVENT_MONTH = 10; // October
    const START_MONTH = EVENT_MONTH - 8;
    const END_MONTH = EVENT_MONTH + 2;

    const revBuckets = {};
    const expBuckets = {};
    let totalRev = 0; let totalExp = 0;
    let totalRevBudget = 0; let totalExpBudget = 0;

    function initBucket(obj, name, id) {
        if (!obj[name]) obj[name] = { name: name, id: id, total: 0, budget: 0, txns: [] };
    }

    function aggregateData(records, isExpense, bucketsObj) {
        records.forEach(record => {
            const date = new Date(record.TxnDate);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            if (year === TARGET_YEAR && month >= START_MONTH && month <= END_MONTH) {
                record.Line.forEach(line => {
                    const amt = line.Amount;
                    if (!amt) return;

                    let acctName = "";
                    let acctId = "";
                    if (isExpense && line.DetailType === "AccountBasedExpenseLineDetail") {
                        acctName = line.AccountBasedExpenseLineDetail.AccountRef.name.split(':').pop();
                        acctId = line.AccountBasedExpenseLineDetail.AccountRef.value;
                    } else if (!isExpense && line.DetailType === "DepositLineDetail") {
                        acctName = line.DepositLineDetail.AccountRef.name.split(':').pop();
                        acctId = line.DepositLineDetail.AccountRef.value;
                    }

                    if (acctName) {
                        initBucket(bucketsObj, acctName, acctId);
                        bucketsObj[acctName].total += amt;

                        let desc = line.Description || (record.EntityRef ? record.EntityRef.name : "Online Transaction");
                        bucketsObj[acctName].txns.push({ date: record.TxnDate, desc: desc, amount: amt });

                        if (isExpense) totalExp += amt;
                        else totalRev += amt;
                    }
                });
            }
        });
    }

    aggregateData(luncheonDeposits, false, revBuckets);
    aggregateData(luncheonExpenses, true, expBuckets);

    // ==========================================
    // PARSE THE BUDGET FOR THE TARGET YEAR
    // ==========================================
    if (data.Budgets) {
        // Find the budget that matches our dynamic TARGET_YEAR
        const targetBudget = data.Budgets.find(b =>
            (b.Name && b.Name.includes(TARGET_YEAR.toString())) ||
            (b.StartDate && b.StartDate.startsWith(TARGET_YEAR.toString()))
        );

        if (targetBudget && targetBudget.Line) {
            targetBudget.Line.forEach(line => {
                const accId = line.AccountRef.value;
                const amt = line.Amount;

                Object.values(revBuckets).forEach(b => {
                    if (b.id === accId) { b.budget += amt; totalRevBudget += amt; }
                });
                Object.values(expBuckets).forEach(b => {
                    if (b.id === accId) { b.budget += amt; totalExpBudget += amt; }
                });
            });
        }
    }

    const sortedRev = Object.values(revBuckets).sort((a, b) => b.total - a.total);
    const sortedExp = Object.values(expBuckets).sort((a, b) => b.total - a.total);
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    // ==========================================
    // CHART 1: NET PERFORMANCE W/ BUDGET OVERLAY
    // ==========================================
    d3.select("#chart-net-performance").html("");
    const marginNet = { top: 30, right: 30, bottom: 30, left: 60 },
        widthNet = 800 - marginNet.left - marginNet.right,
        heightNet = 250 - marginNet.top - marginNet.bottom;

    const svgNet = d3.select("#chart-net-performance")
        .append("svg").attr("viewBox", `0 0 ${widthNet + marginNet.left + marginNet.right} ${heightNet + marginNet.top + marginNet.bottom}`)
        .append("g").attr("transform", `translate(${marginNet.left},${marginNet.top})`);

    const xNet = d3.scaleBand().domain(["Total Revenue", "Total Expenses"]).range([0, widthNet]).padding(0.4);
    const maxVal = Math.max(totalRev, totalExp, totalRevBudget, totalExpBudget) * 1.1 || 1;
    const yNet = d3.scaleLinear().domain([0, maxVal]).range([heightNet, 0]);

    svgNet.append("g").attr("transform", `translate(0,${heightNet})`)
        .call(d3.axisBottom(xNet).tickSizeOuter(0)).selectAll("text").style("font-size", "14px").style("font-weight", "bold");
    svgNet.append("g").attr("class", "grid")
        .call(d3.axisLeft(yNet).tickSize(-widthNet).tickFormat(d => "$" + d.toLocaleString()).ticks(5)).style("stroke-dasharray", "3,3").style("opacity", 0.1);
    svgNet.select(".domain").remove();

    const netData = [
        { label: "Total Revenue", actual: totalRev, budget: totalRevBudget, color: "#10b981", bg: "rgba(16, 185, 129, 0.2)" },
        { label: "Total Expenses", actual: totalExp, budget: totalExpBudget, color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)" }
    ];

    svgNet.selectAll(".bg-bar").data(netData).enter().append("rect")
        .attr("x", d => xNet(d.label) - 10).attr("y", d => yNet(d.budget))
        .attr("width", xNet.bandwidth() + 20).attr("height", d => heightNet - yNet(d.budget))
        .attr("fill", d => d.bg).attr("rx", 4);

    svgNet.selectAll(".fg-bar").data(netData).enter().append("rect")
        .attr("x", d => xNet(d.label)).attr("y", d => yNet(d.actual))
        .attr("width", xNet.bandwidth()).attr("height", d => heightNet - yNet(d.actual))
        .attr("fill", d => d.color).attr("rx", 4)
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip.transition().duration(200).style("opacity", 1);
            const diff = d.actual - d.budget;
            const diffText = diff > 0 ? `+$${diff.toLocaleString()}` : `-$${Math.abs(diff).toLocaleString()}`;
            tooltip.html(`
                <div style="font-weight:bold; font-size:14px; margin-bottom:4px;">${d.label}</div>
                <div>Actual: <b style="color:${d.color}">$${d.actual.toLocaleString()}</b></div>
                <div>Budget: <b style="color:#cbd5e1">$${d.budget.toLocaleString()}</b></div>
                <div style="font-size: 12px; margin-top:4px; color:#94a3b8;">Variance: ${diffText}</div>
            `).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // ==========================================
    // CHART 1.5: ACCOUNT-LEVEL BUDGET VS ACTUALS
    // ==========================================
    d3.select("#chart-budget-actuals").html("");
    const combinedData = [...sortedRev.map(d => ({ ...d, type: 'Rev' })), ...sortedExp.map(d => ({ ...d, type: 'Exp' }))];

    const marginAcc = { top: 20, right: 30, bottom: 40, left: 120 },
        widthAcc = 800 - marginAcc.left - marginAcc.right,
        heightAcc = (combinedData.length * 40) || 100;

    const svgAcc = d3.select("#chart-budget-actuals")
        .append("svg").attr("viewBox", `0 0 ${widthAcc + marginAcc.left + marginAcc.right} ${heightAcc + marginAcc.top + marginAcc.bottom}`)
        .append("g").attr("transform", `translate(${marginAcc.left},${marginAcc.top})`);

    const yAcc = d3.scaleBand().domain(combinedData.map(d => d.name)).range([0, heightAcc]).padding(0.4);
    const maxAccVal = d3.max(combinedData, d => Math.max(d.total, d.budget)) * 1.1 || 1;
    const xAcc = d3.scaleLinear().domain([0, maxAccVal]).range([0, widthAcc]);

    svgAcc.append("g").call(d3.axisLeft(yAcc).tickSize(0)).selectAll("text").style("font-size", "12px").style("fill", "#cbd5e1");
    svgAcc.select(".domain").remove();

    svgAcc.selectAll(".bg-acc").data(combinedData).enter().append("rect")
        .attr("y", d => yAcc(d.name) - 4).attr("x", 0).attr("height", yAcc.bandwidth() + 8).attr("width", d => xAcc(d.budget))
        .attr("fill", d => d.type === 'Rev' ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)").attr("rx", 2);

    svgAcc.selectAll(".fg-acc").data(combinedData).enter().append("rect")
        .attr("y", d => yAcc(d.name)).attr("x", 0).attr("height", yAcc.bandwidth()).attr("width", d => xAcc(d.total))
        .attr("fill", d => d.type === 'Rev' ? "#10b981" : "#ef4444").attr("rx", 2)
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <div style="font-weight:bold; font-size:14px; margin-bottom:4px;">${d.name}</div>
                <div>Actual: <b>$${d.total.toLocaleString()}</b></div>
                <div>Budget: <b>$${d.budget.toLocaleString()}</b></div>
            `).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // ==========================================
    // CHARTS 2 & 3: COMPOSITION BARS
    // ==========================================
    function drawCompositionChart(containerId, sortedData, totalAmount, colorScale, isExp) {
        d3.select(containerId).html("");
        const compHeight = 60, widthComp = 900;
        const svgComp = d3.select(containerId).append("svg").attr("viewBox", `0 0 ${widthComp} ${compHeight}`);
        const xComp = d3.scaleLinear().domain([0, totalAmount || 1]).range([0, widthComp]);
        let currentX = 0;

        sortedData.forEach((bucket, i) => {
            const segWidth = xComp(bucket.total);
            const g = svgComp.append("g").attr("transform", `translate(${currentX}, 0)`);

            g.append("rect")
                .attr("width", segWidth).attr("height", compHeight)
                .attr("fill", colorScale(i)).attr("stroke", "#0f172a").attr("stroke-width", 2)
                .style("cursor", "pointer")
                .on("mouseover", (event) => showTooltip(event, bucket, isExp, totalAmount))
                .on("mouseout", hideTooltip)
                .on("click", () => filterByAccount(isExp ? 'exp-table' : 'rev-table', bucket.name, isExp));

            if (segWidth > 80) {
                g.append("text")
                    .attr("x", segWidth / 2).attr("y", compHeight / 2).attr("dy", ".35em")
                    .style("text-anchor", "middle").style("fill", isExp ? "#540000" : "#020617").style("font-size", "12px").style("font-weight", "600")
                    .style("pointer-events", "none").text(bucket.name);
            }
            currentX += segWidth;
        });
    }

    drawCompositionChart("#chart-rev-composition", sortedRev, totalRev, d3.scaleOrdinal().range(["#059669", "#10b981", "#34d399", "#6ee7b7"]), false);
    drawCompositionChart("#chart-exp-composition", sortedExp, totalExp, d3.scaleOrdinal().range(["#b91c1c", "#ef4444", "#f87171", "#fca5a5", "#fecaca"]), true);

    function showTooltip(event, bucket, isExp, grandTotal) {
        d3.select(event.currentTarget).style("opacity", 0.7);
        tooltip.transition().duration(200).style("opacity", 1);
        const percent = ((bucket.total / grandTotal) * 100).toFixed(1);

        let innerHtml = `
            <div style="border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color:${isExp ? '#ef4444' : '#10b981'}; font-weight:bold; font-size: 14px;">${bucket.name.toUpperCase()}</span><br>
                <span style="color:#f8fafc; font-size: 18px; font-weight: 700;">$${bucket.total.toLocaleString()} Total</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px; border-bottom: 1px dashed #475569; padding-bottom: 8px;">
                <span style="color:#94a3b8;">Share of Total:</span> 
                <span style="color:#f8fafc; font-weight:bold;">${percent}%</span>
            </div>
        `;

        if (isExp) {
            bucket.txns.sort((a, b) => b.amount - a.amount);
            const topTxns = bucket.txns.slice(0, 5);
            innerHtml += topTxns.map(t =>
                `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#cbd5e1; padding-right:16px;">${t.date} | ${t.desc.substring(0, 25)}${t.desc.length > 25 ? '...' : ''}</span>
                    <span style="font-family:monospace;">$${t.amount.toLocaleString()}</span>
                </div>`
            ).join("");

            if (bucket.txns.length - 5 > 0) innerHtml += `<div style="color:#64748b; margin-top:8px; font-size:11px; text-align:center;">+ ${bucket.txns.length - 5} more transactions...</div>`;
        } else {
            innerHtml += `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
                    <span style="color:#94a3b8;">Total Contributions:</span> 
                    <span style="color:#f8fafc; font-weight:bold;">${bucket.txns.length}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13px;">
                    <span style="color:#94a3b8;">Average Amount:</span> 
                    <span style="color:#f8fafc; font-weight:bold;">$${(bucket.total / bucket.txns.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            `;
        }
        tooltip.html(innerHtml).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip(event) {
        d3.select(event.currentTarget).style("opacity", 1);
        tooltip.transition().duration(500).style("opacity", 0);
    }

    // --- POPULATE TABLES & SEARCH LOGIC ---
    function populateTable(tbodyId, buckets, isExp) {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = "";
        let allTxns = [];
        Object.values(buckets).forEach(b => b.txns.forEach(t => allTxns.push({ ...t, account: b.name })));

        allTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

        allTxns.forEach(t => {
            const tr = document.createElement("tr");
            tr.setAttribute("data-account", t.account);
            tr.innerHTML = `
                <td>${t.date}</td>
                <td><strong>${t.desc}</strong></td>
                <td><span class="badge ${isExp ? 'expense' : 'sponsor'}">${t.account}</span></td>
                <td style="font-family: monospace; font-size:14px; color:${isExp ? '#ef4444' : '#10b981'};">$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    populateTable("rev-tbody", revBuckets, false);
    populateTable("exp-tbody", expBuckets, true);

    let activeRevFilter = null;
    let activeExpFilter = null;

    window.filterByAccount = function (tableId, accountName, isExp) {
        if (isExp) {
            activeExpFilter = (activeExpFilter === accountName) ? null : accountName;
            accountName = activeExpFilter;
            document.getElementById('exp-search').value = "";
        } else {
            activeRevFilter = (activeRevFilter === accountName) ? null : accountName;
            accountName = activeRevFilter;
            document.getElementById('rev-search').value = "";
        }

        const rows = document.getElementById(tableId).querySelector("tbody").getElementsByTagName("tr");
        for (let row of rows) {
            row.style.display = (!accountName || row.getAttribute("data-account") === accountName) ? "" : "none";
        }
    };

    window.searchTable = function (tableId, query) {
        query = query.toLowerCase();
        if (tableId === 'rev-table') activeRevFilter = null;
        if (tableId === 'exp-table') activeExpFilter = null;

        const rows = document.getElementById(tableId).querySelector("tbody").getElementsByTagName("tr");
        for (let row of rows) row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none";
    };

    window.resetFilters = function (tableId) {
        if (tableId === 'rev-table') {
            activeRevFilter = null;
            document.getElementById('rev-search').value = "";
        } else {
            activeExpFilter = null;
            document.getElementById('exp-search').value = "";
        }
        const rows = document.getElementById(tableId).querySelector("tbody").getElementsByTagName("tr");
        for (let row of rows) row.style.display = "";
    };

}).catch(error => {
    console.error("Error loading data:", error);
});

// Sorting Logic
let sortDirs = { 'rev-table': false, 'exp-table': false };
function sortTable(tableId, columnIndex) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.rows);

    sortDirs[tableId] = !sortDirs[tableId];
    const isAscending = sortDirs[tableId];

    rows.sort((a, b) => {
        let cellA = a.cells[columnIndex].innerText.replace(/[^0-9a-zA-Z.-]+/g, "");
        let cellB = b.cells[columnIndex].innerText.replace(/[^0-9a-zA-Z.-]+/g, "");

        if (!isNaN(cellA) && !isNaN(cellB)) return isAscending ? cellA - cellB : cellB - cellA;
        return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    rows.forEach(row => tbody.appendChild(row));
}

// Toggle Ledger Visibility
window.toggleLedger = function (containerId, btnElement) {
    const container = document.getElementById(containerId);
    if (container.style.display === "none") {
        container.style.display = "block";
        btnElement.innerText = "👁️‍🗨️ Hide Transaction Ledger";
    } else {
        container.style.display = "none";
        btnElement.innerText = "👁️ Show Transaction Ledger";
    }
};
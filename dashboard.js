d3.json("data.json").then(data => {

    // ==========================================
    // THE STRICT FILTER: ONLY "LUNCHEON" DATA
    // ==========================================
    const luncheonDeposits = [];
    const luncheonExpenses = [];

    // Filter Deposits
    if (data.Deposits) {
        data.Deposits.forEach(record => {
            let recordHasLuncheon = false;
            const validLines = [];
            record.Line.forEach(line => {
                if (line.Amount && line.DetailType === "DepositLineDetail" && line.DepositLineDetail.AccountRef) {
                    const accountName = line.DepositLineDetail.AccountRef.name.toLowerCase();
                    if (accountName.includes("luncheon")) {
                        recordHasLuncheon = true;
                        validLines.push(line);
                    }
                }
            });
            // If this transaction belongs to the luncheon, keep it (with only the valid lines)
            if (recordHasLuncheon) {
                luncheonDeposits.push({ ...record, Line: validLines });
            }
        });
    }

    // Filter Expenses
    if (data.Expenses) {
        data.Expenses.forEach(record => {
            let recordHasLuncheon = false;
            record.Line.forEach(line => {
                if (line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail.AccountRef) {
                    const accountName = line.AccountBasedExpenseLineDetail.AccountRef.name.toLowerCase();
                    if (accountName.includes("luncheon")) {
                        recordHasLuncheon = true;
                    }
                }
            });
            if (recordHasLuncheon) {
                luncheonExpenses.push(record);
            }
        });
    }


    // ==========================================
    // PART 1: THE 3-TIER EVENT DASHBOARD
    // ==========================================
    const TARGET_YEAR = 2025;
    const EVENT_MONTH = 10; // October
    const START_MONTH = EVENT_MONTH - 8;
    const END_MONTH = EVENT_MONTH + 2;

    const revBuckets = {};
    const expBuckets = {};
    let totalRev = 0;
    let totalExp = 0;

    // Aggregate Data
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
                    if (isExpense && line.DetailType === "AccountBasedExpenseLineDetail") {
                        acctName = line.AccountBasedExpenseLineDetail.AccountRef.name.split(':').pop();
                    } else if (!isExpense && line.DetailType === "DepositLineDetail") {
                        acctName = line.DepositLineDetail.AccountRef.name.split(':').pop();
                    }

                    if (acctName) {
                        if (!bucketsObj[acctName]) {
                            bucketsObj[acctName] = { name: acctName, total: 0, txns: [] };
                        }
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

    const sortedRev = Object.values(revBuckets).sort((a, b) => b.total - a.total);
    const sortedExp = Object.values(expBuckets).sort((a, b) => b.total - a.total);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    // --- CHART 1: NET PERFORMANCE (Vertical Bar Chart) ---
    d3.select("#chart-net-performance").html("");
    const marginNet = { top: 30, right: 30, bottom: 30, left: 60 },
        widthNet = 800 - marginNet.left - marginNet.right,
        heightNet = 300 - marginNet.top - marginNet.bottom;

    const svgNet = d3.select("#chart-net-performance")
        .append("svg")
        .attr("viewBox", `0 0 ${widthNet + marginNet.left + marginNet.right} ${heightNet + marginNet.top + marginNet.bottom}`)
        .append("g")
        .attr("transform", `translate(${marginNet.left},${marginNet.top})`);

    const xNet = d3.scaleBand().domain(["Total Revenue", "Total Expenses"]).range([0, widthNet]).padding(0.4);
    const maxNet = Math.max(totalRev, totalExp) * 1.1 || 1;
    const yNet = d3.scaleLinear().domain([0, maxNet]).range([heightNet, 0]);

    svgNet.append("g").attr("transform", `translate(0,${heightNet})`)
        .call(d3.axisBottom(xNet).tickSizeOuter(0))
        .selectAll("text").style("font-size", "14px").style("font-weight", "bold");

    svgNet.append("g").attr("class", "grid")
        .call(d3.axisLeft(yNet).tickSize(-widthNet).tickFormat(d => "$" + d.toLocaleString()).ticks(5))
        .style("stroke-dasharray", "3,3").style("opacity", 0.1);
    svgNet.select(".domain").remove();

    const netData = [
        { label: "Total Revenue", value: totalRev, color: "#10b981" },
        { label: "Total Expenses", value: totalExp, color: "#ef4444" }
    ];

    svgNet.selectAll(".net-bar")
        .data(netData).enter().append("rect")
        .attr("x", d => xNet(d.label))
        .attr("y", d => yNet(d.value))
        .attr("width", xNet.bandwidth())
        .attr("height", d => heightNet - yNet(d.value))
        .attr("fill", d => d.color)
        .attr("rx", 4);

    // Labels on top of bars
    svgNet.selectAll(".net-label")
        .data(netData).enter().append("text")
        .attr("x", d => xNet(d.label) + xNet.bandwidth() / 2)
        .attr("y", d => yNet(d.value) - 10)
        .style("text-anchor", "middle").style("fill", "#f8fafc").style("font-weight", "bold").style("font-size", "14px")
        .text(d => `$${d.value.toLocaleString(undefined, { minimumFractionDigits: 0 })}`);

    // --- HELPER FUNCTION FOR HORIZONTAL BARS ---
    function drawCompositionChart(containerId, sortedData, totalAmount, colorScale, isExp) {
        d3.select(containerId).html("");
        const compHeight = 60;
        const widthComp = 900;

        const svgComp = d3.select(containerId).append("svg")
            .attr("viewBox", `0 0 ${widthComp} ${compHeight}`);

        const xComp = d3.scaleLinear().domain([0, totalAmount || 1]).range([0, widthComp]);
        let currentX = 0;

        sortedData.forEach((bucket, i) => {
            const segWidth = xComp(bucket.total);
            const g = svgComp.append("g").attr("transform", `translate(${currentX}, 0)`);

            g.append("rect")
                .attr("width", segWidth).attr("height", compHeight)
                .attr("fill", colorScale(i)).attr("stroke", "#0f172a").attr("stroke-width", 2)
                .on("mouseover", (event) => showTooltip(event, bucket, isExp, totalAmount))
                .on("mouseout", hideTooltip);

            if (segWidth > 80) {
                g.append("text")
                    .attr("x", segWidth / 2).attr("y", compHeight / 2).attr("dy", ".35em")
                    .style("text-anchor", "middle").style("fill", isExp ? "#540000" : "#020617").style("font-size", "12px").style("font-weight", "600")
                    .style("pointer-events", "none")
                    .text(bucket.name);
            }
            currentX += segWidth;
        });
    }

    // DRAW CHART 2: REVENUE COMPOSITION
    const colorRev = d3.scaleOrdinal().range(["#059669", "#10b981", "#34d399", "#6ee7b7"]);
    drawCompositionChart("#chart-rev-composition", sortedRev, totalRev, colorRev, false);

    // DRAW CHART 3: EXPENSE COMPOSITION
    const colorExp = d3.scaleOrdinal().range(["#b91c1c", "#ef4444", "#f87171", "#fca5a5", "#fecaca"]);
    drawCompositionChart("#chart-exp-composition", sortedExp, totalExp, colorExp, true);

    // --- ADVANCED TOOLTIP LOGIC ---
    function showTooltip(event, bucket, isExp, grandTotal) {
        d3.select(event.currentTarget).style("opacity", 0.7);
        tooltip.transition().duration(200).style("opacity", 1);

        let innerHtml = `
            <div style="border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color:${isExp ? '#ef4444' : '#10b981'}; font-weight:bold; font-size: 14px;">${bucket.name.toUpperCase()}</span><br>
                <span style="color:#f8fafc; font-size: 18px; font-weight: 700;">$${bucket.total.toLocaleString()} Total</span>
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

            const remaining = bucket.txns.length - 5;
            if (remaining > 0) {
                innerHtml += `<div style="color:#64748b; margin-top:8px; font-size:11px; text-align:center;">+ ${remaining} more transactions...</div>`;
            }
        } else {
            const count = bucket.txns.length;
            const avg = bucket.total / count;
            const percent = ((bucket.total / grandTotal) * 100).toFixed(1);

            innerHtml += `
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
                    <span style="color:#94a3b8;">Total Contributions:</span> 
                    <span style="color:#f8fafc; font-weight:bold;">${count}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
                    <span style="color:#94a3b8;">Average Amount:</span> 
                    <span style="color:#f8fafc; font-weight:bold;">$${avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:13px;">
                    <span style="color:#94a3b8;">Share of Revenue:</span> 
                    <span style="color:#f8fafc; font-weight:bold;">${percent}%</span>
                </div>
            `;
        }

        tooltip.html(innerHtml)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    function hideTooltip(event) {
        d3.select(event.currentTarget).style("opacity", 1);
        tooltip.transition().duration(500).style("opacity", 0);
    }
    
    // ==========================================
    // PART 2: KPIs AND SPLIT TABLES
    // ==========================================
    let totalRegistrants = 0;
    let totalSponsors = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    const revenueRows = [];
    const expenseRows = [];

    // Note: We are now looping over the FILTERED arrays
    luncheonDeposits.forEach(record => {
        const date = record.TxnDate;
        record.Line.forEach(line => {
            totalIncome += line.Amount;

            const accountName = line.DepositLineDetail.AccountRef.name.toLowerCase();
            const isSponsor = accountName.includes("sponsor");
            if (isSponsor) totalSponsors++; else totalRegistrants++;

            const typeClass = isSponsor ? 'sponsor' : 'registrant';
            const typeLabel = isSponsor ? 'Sponsor' : 'Registrant';

            let name = "Online Contributor";
            if (line.Entity?.EntityRef?.name) name = line.Entity.EntityRef.name;
            else if (line.Description) name = line.Description;

            revenueRows.push({
                date: date,
                name: name,
                typeHTML: `<span class="badge ${typeClass}">${typeLabel}</span>`,
                amount: line.Amount
            });
        });
    });

    luncheonExpenses.forEach(record => {
        const date = record.TxnDate;
        const name = record.EntityRef?.name || "Vendor";
        totalExpense += record.TotalAmt || 0;

        expenseRows.push({
            date: date,
            name: name,
            amount: record.TotalAmt || 0
        });
    });

    // Update KPIs
    document.getElementById("kpi-registrants").innerText = totalRegistrants.toLocaleString();
    document.getElementById("kpi-sponsors").innerText = totalSponsors.toLocaleString();
    document.getElementById("kpi-net").innerText = "$" + (totalIncome - totalExpense).toLocaleString(undefined, { minimumFractionDigits: 2 });

    // Populate Revenue Table
    revenueRows.sort((a, b) => new Date(b.date) - new Date(a.date));
    const revBody = document.getElementById("rev-tbody");
    revenueRows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.date}</td>
            <td><strong>${row.name}</strong></td>
            <td>${row.typeHTML}</td>
            <td style="font-family: monospace; font-size:14px; color:#10b981;">$${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        `;
        revBody.appendChild(tr);
    });

    // Populate Expense Table
    expenseRows.sort((a, b) => new Date(b.date) - new Date(a.date));
    const expBody = document.getElementById("exp-tbody");
    expenseRows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.date}</td>
            <td><strong>${row.name}</strong></td>
            <td style="font-family: monospace; font-size:14px; color:#ef4444;">$${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        `;
        expBody.appendChild(tr);
    });

}).catch(error => {
    console.error("Error loading data:", error);
    d3.select("#chart-events").html("<p style='color:red;'>Waiting for data...</p>");
});

// ==========================================
// PART 3: THE DYNAMIC SORTING FUNCTION
// ==========================================
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

        if (!isNaN(cellA) && !isNaN(cellB)) {
            return isAscending ? cellA - cellB : cellB - cellA;
        }
        return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    rows.forEach(row => tbody.appendChild(row));
}
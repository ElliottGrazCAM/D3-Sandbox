let globalData = null;
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// Load the data ONCE when the page opens (with Cache-Buster!)
d3.json(`data.json?v=${new Date().getTime()}`).then(data => {
    globalData = data;

    // Set default dropdown value to Prior Year automatically on load
    const defaultYear = new Date().getFullYear() - 1;
    document.getElementById("year-select").value = defaultYear;

    renderOverview();
}).catch(error => {
    console.error("CRITICAL ERROR: Failed to load or parse data.json", error);
});

// Dropdown Change Handler
window.changeYear = function () {
    renderOverview(); // Redraw overview charts with the new year!
};

// ==========================================
// MASTER RENDER FUNCTION (OVERVIEW)
// ==========================================
function renderOverview() {
    if (!globalData) return;

    // READ THE DYNAMIC YEAR DIRECTLY FROM THE DROPDOWN!
    const TARGET_YEAR = parseInt(document.getElementById("year-select").value);

    // DYNAMIC EXPLAINER TEXT FOR OVERVIEW
    const explainerHtml = `
        <ul>
            <li><strong>Target Year:</strong> ${TARGET_YEAR}</li>
            <li><strong>Date Window:</strong> Strict calendar year (January 1, ${TARGET_YEAR} to December 31, ${TARGET_YEAR}).</li>
            <li><strong>Event Totals:</strong> Aggregates any account name containing "Annual Conference", "Annual Luncheon", "Winter Gala", "Golf Tournament", "Annual Conference", or "Online Event".</li>
            <li><strong>Admin Overhead:</strong> Aggregates accounts starting exactly with <code>"Administrative Expenses"</code> or <code>"Software/Communications"</code>.</li>
        </ul>
    `;
    const explainerText = document.getElementById("explainer-text");
    if (explainerText) explainerText.innerHTML = explainerHtml;

    let totalAnnualRev = 0;
    let totalAnnualExp = 0;

    // NEW: Data structure to hold our 12 months of cash flow
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const cashFlowData = months.map(m => ({ month: m, rev: 0, exp: 0 }));

    const events = {
        "Luncheon": { rev: 0, exp: 0 },
        "Winter Gala": { rev: 0, exp: 0 },
        "Golf Tournament": { rev: 0, exp: 0 },
        "Conference": { rev: 0, exp: 0 },
        "Online Events": { rev: 0, exp: 0 }
    };
    const admins = {};

    function processMacroData(records, isExpense) {
        if (!records) return;
        records.forEach(record => {
            const txnDate = new Date(record.TxnDate);
            const year = txnDate.getFullYear();
            const monthIdx = txnDate.getMonth(); // Grabs the 0-11 index of the month

            if (year === TARGET_YEAR) {
                if (!record.Line) return;
                record.Line.forEach(line => {
                    const amt = line.Amount;
                    if (!amt || amt === 0) return;

                    let acctName = "";
                    if (isExpense && line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail.AccountRef) {
                        acctName = line.AccountBasedExpenseLineDetail.AccountRef.name || "";
                    } else if (!isExpense && line.DetailType === "DepositLineDetail" && line.DepositLineDetail.AccountRef) {
                        acctName = line.DepositLineDetail.AccountRef.name || "";
                    }

                    // Log the grand totals AND the monthly totals
                    if (isExpense) {
                        totalAnnualExp += amt;
                        cashFlowData[monthIdx].exp += amt;
                    } else {
                        totalAnnualRev += amt;
                        cashFlowData[monthIdx].rev += amt;
                    }

                    // Event logic
                    if (acctName.includes("Annual Luncheon")) {
                        isExpense ? events["Luncheon"].exp += amt : events["Luncheon"].rev += amt;
                    } else if (acctName.includes("Winter Gala")) {
                        isExpense ? events["Winter Gala"].exp += amt : events["Winter Gala"].rev += amt;
                    } else if (acctName.includes("Golf Tournament")) {
                        isExpense ? events["Golf Tournament"].exp += amt : events["Golf Tournament"].rev += amt;
                    } else if (acctName.includes("Annual Conference")) {
                        isExpense ? events["Conference"].exp += amt : events["Conference"].rev += amt;
                    } else if (acctName.startsWith("Online Event")) {
                        isExpense ? events["Online Events"].exp += amt : events["Online Events"].rev += amt;
                    }

                    // Admin logic
                    if (acctName.startsWith("Administrative Expenses") || acctName.startsWith("Software/Communications")) {
                        let shortName = acctName.includes(":") ? acctName.split(":")[1] : acctName;
                        if (shortName === "Administrative Expenses") shortName = "Other Admin";
                        if (!admins[shortName]) admins[shortName] = 0;
                        admins[shortName] += amt;
                    }
                });
            }
        });
    }

    processMacroData(globalData.Deposits, false);
    processMacroData(globalData.Expenses, true);

    const netIncome = totalAnnualRev - totalAnnualExp;
    d3.select("#ov-total-rev").text(`$${totalAnnualRev.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
    d3.select("#ov-total-exp").text(`$${totalAnnualExp.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
    d3.select("#ov-net-income")
        .text(netIncome < 0 ? `-$${Math.abs(netIncome).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `$${netIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)
        .style("color", netIncome < 0 ? "#ef4444" : "#10b981");

    // ==========================================
    // CHART A: EVENT PERFORMANCE
    // ==========================================
    d3.select("#chart-ov-events").html("");
    const eventData = Object.keys(events).map(k => ({ name: k, rev: events[k].rev, exp: events[k].exp }));
    const marginEv = { top: 5, right: 20, bottom: 20, left: 60 }, widthEv = 900 - marginEv.left - marginEv.right, heightEv = 300 - marginEv.top - marginEv.bottom;

    const svgEv = d3.select("#chart-ov-events").append("svg")
        .attr("viewBox", `0 0 ${widthEv + marginEv.left + marginEv.right} ${heightEv + marginEv.top + marginEv.bottom}`)
        .attr("width", "100%")
        .style("height", "auto") // FIXED OVERFLOW BUG
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g").attr("transform", `translate(${marginEv.left},${marginEv.top})`);

    const x0Ev = d3.scaleBand().domain(eventData.map(d => d.name)).range([0, widthEv]).padding(0.2);
    const x1Ev = d3.scaleBand().domain(["rev", "exp"]).range([0, x0Ev.bandwidth()]).padding(0.05);
    const maxEv = d3.max(eventData, d => Math.max(d.rev, d.exp)) * 1.1 || 1;
    const yEv = d3.scaleLinear().domain([0, maxEv]).range([heightEv, 0]);

    svgEv.append("g").attr("transform", `translate(0,${heightEv})`).call(d3.axisBottom(x0Ev)).selectAll("text").style("font-size", "14px").style("fill", "#cbd5e1");
    svgEv.append("g").attr("class", "grid").call(d3.axisLeft(yEv).ticks(5).tickFormat(d => "$" + d.toLocaleString()).tickSize(-widthEv)).style("stroke-dasharray", "3,3").style("opacity", 0.1);
    svgEv.select(".domain").remove();

    const evGroup = svgEv.selectAll(".ev-group").data(eventData).enter().append("g").attr("transform", d => `translate(${x0Ev(d.name)},0)`);
    evGroup.selectAll("rect").data(d => [{ key: "rev", val: d.rev, name: d.name }, { key: "exp", val: d.exp, name: d.name }])
        .enter().append("rect").attr("x", d => x1Ev(d.key)).attr("y", d => yEv(d.val)).attr("width", x1Ev.bandwidth()).attr("height", d => heightEv - yEv(d.val)).attr("fill", d => d.key === "rev" ? "#10b981" : "#ef4444").attr("rx", 3)
        .on("mouseover", function (event, d) {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<b>${d.name} ${d.key === 'rev' ? 'Revenue' : 'Expenses'}</b><br><span style="font-size:16px; color:${d.key === 'rev' ? '#10b981' : '#ef4444'}">$${d.val.toLocaleString()}</span>`)
                .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        }).on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));

    // ==========================================
    // CHART B: MONTHLY CASH FLOW
    // ==========================================
    d3.select("#chart-ov-cashflow").html("");

    // We make the chart taller (350px base height) to give the bars vertical breathing room
    const marginCf = { top: 20, right: 20, bottom: 30, left: 50 };
    const widthCf = 500 - marginCf.left - marginCf.right;
    const heightCf = 350 - marginCf.top - marginCf.bottom; // Increased from 250!

    const svgCf = d3.select("#chart-ov-cashflow").append("svg")
        .attr("viewBox", `0 0 ${widthCf + marginCf.left + marginCf.right} ${heightCf + marginCf.top + marginCf.bottom}`)
        .attr("width", "100%")
        .style("height", "auto")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g").attr("transform", `translate(${marginCf.left},${marginCf.top})`);

    const x0Cf = d3.scaleBand().domain(months).range([0, widthCf]).padding(0.2);
    const x1Cf = d3.scaleBand().domain(["rev", "exp"]).range([0, x0Cf.bandwidth()]).padding(0.05);
    const maxCf = d3.max(cashFlowData, d => Math.max(d.rev, d.exp)) * 1.1 || 1;
    const yCf = d3.scaleLinear().domain([0, maxCf]).range([heightCf, 0]);

    // X-Axis (Months)
    svgCf.append("g")
        .attr("transform", `translate(0,${heightCf})`)
        .call(d3.axisBottom(x0Cf).tickSizeOuter(0))
        .selectAll("text").style("font-size", "11px").style("fill", "#cbd5e1");

    // Y-Axis (Values format to "k" for thousands to save space)
    svgCf.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yCf).ticks(5).tickFormat(d => "$" + (d >= 1000 ? (d / 1000).toFixed(0) + "k" : d)).tickSize(-widthCf))
        .style("stroke-dasharray", "3,3").style("opacity", 0.1);
    svgCf.select(".domain").remove();

    // Grouping the bars by month
    const cfGroup = svgCf.selectAll(".cf-group").data(cashFlowData).enter().append("g").attr("transform", d => `translate(${x0Cf(d.month)},0)`);

    // Drawing the Rev and Exp bars inside each month
    cfGroup.selectAll("rect").data(d => [
        { key: "rev", val: d.rev, month: d.month },
        { key: "exp", val: d.exp, month: d.month }
    ])
        .enter().append("rect")
        .attr("x", d => x1Cf(d.key))
        .attr("y", d => yCf(d.val))
        .attr("width", x1Cf.bandwidth())
        .attr("height", d => heightCf - yCf(d.val))
        .attr("fill", d => d.key === "rev" ? "#10b981" : "#ef4444")
        .attr("rx", 2)
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<b>${d.month} ${d.key === 'rev' ? 'Revenue' : 'Expenses'}</b><br><span style="font-size:16px; color:${d.key === 'rev' ? '#10b981' : '#ef4444'}">$${d.val.toLocaleString()}</span>`)
                .style("left", () => (event.pageX + 15 + tooltip.node().offsetWidth > window.innerWidth - 20) ? (event.pageX - tooltip.node().offsetWidth - 15) + "px" : (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        }).on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // ==========================================
    // CHART C: ADMIN & SOFTWARE EXPENSES
    // ==========================================
    d3.select("#chart-ov-admin").html("");
    const adData = Object.keys(admins).map(k => ({ name: k, total: admins[k] })).sort((a, b) => b.total - a.total);
    if (adData.length > 0) {
        // Standardized to 500x350 so it perfectly matches the height of the Cash Flow card next to it
        const marginAd = { top: 20, right: 30, bottom: 20, left: 130 }; // Widened left margin for long text
        const widthAd = 500 - marginAd.left - marginAd.right; // Increased from 400!
        const heightAd = 350 - marginAd.top - marginAd.bottom; // Increased from 250!
        
        const svgAd = d3.select("#chart-ov-admin").append("svg")
            .attr("viewBox", `0 0 ${widthAd + marginAd.left + marginAd.right} ${heightAd + marginAd.top + marginAd.bottom}`)
            .attr("width", "100%")
            .style("height", "auto") // FIXED OVERFLOW BUG
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g").attr("transform", `translate(${marginAd.left},${marginAd.top})`);

        const yAd = d3.scaleBand().domain(adData.map(d => d.name)).range([0, heightAd]).padding(0.3);
        const maxAd = d3.max(adData, d => d.total) * 1.1 || 1;
        const xAd = d3.scaleLinear().domain([0, maxAd]).range([0, widthAd]);

        svgAd.append("g").call(d3.axisLeft(yAd).tickSize(0)).selectAll("text").style("font-size", "12px").style("fill", "#cbd5e1");
        svgAd.select(".domain").remove();
        svgAd.selectAll("rect").data(adData).enter().append("rect").attr("y", d => yAd(d.name)).attr("x", 0).attr("height", yAd.bandwidth()).attr("width", d => xAd(d.total)).attr("fill", "#f59e0b").attr("rx", 3)
            .on("mouseover", function (event, d) {
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`<b>${d.name}</b><br>Total Expense: <span style="color:#f59e0b">$${d.total.toLocaleString()}</span>`)
                    .style("left", () => (event.pageX + 15 + tooltip.node().offsetWidth > window.innerWidth - 20) ? (event.pageX - tooltip.node().offsetWidth - 15) + "px" : (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            }).on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
        svgAd.selectAll(".val-label").data(adData).enter().append("text").attr("y", d => yAd(d.name) + (yAd.bandwidth() / 2) + 4).attr("x", d => xAd(d.total) + 5).text(d => `$${d.total.toLocaleString()}`).style("fill", "#94a3b8").style("font-size", "11px");
    }

    // Call the new Sunburst Chart!
    drawSunburst(TARGET_YEAR);
}

// ==========================================
// CHART D: PROFIT & LOSS SUNBURST
// ==========================================
function drawSunburst(targetYear) {
    const container = d3.select("#chart-sunburst");
    container.html(""); // Clear old chart

    // 1. DATA TRANSFORM: Build the Hierarchy Tree
    const rootData = { name: "P&L", children: [] };

    // NEW: Added txnDate and desc as arguments to store in the leaf nodes
    function addToTree(accountPath, amount, isExpense, txnDate, desc) {
        if (!accountPath || amount <= 0) return;

        let currentLevel = rootData.children;
        const topLevelName = isExpense ? "Expenses" : "Income";

        // Create Income/Expense root if missing
        let topNode = currentLevel.find(d => d.name === topLevelName);
        if (!topNode) {
            topNode = { name: topLevelName, children: [] };
            currentLevel.push(topNode);
        }

        currentLevel = topNode.children;
        const parts = accountPath.split(':');

        // Traverse and build branches
        parts.forEach((part, index) => {
            let existingNode = currentLevel.find(d => d.name === part);

            if (index === parts.length - 1) { // It's a leaf node
                if (existingNode) {
                    existingNode.value = (existingNode.value || 0) + amount;
                    if (!existingNode.txns) existingNode.txns = [];
                    existingNode.txns.push({ date: txnDate, desc: desc, amount: amount });
                } else {
                    currentLevel.push({ name: part, value: amount, txns: [{ date: txnDate, desc: desc, amount: amount }] });
                }
            } else { // It's a parent branch
                if (!existingNode) {
                    existingNode = { name: part, children: [] };
                    currentLevel.push(existingNode);
                }
                currentLevel = existingNode.children || [];
            }
        });
    }

    // Process all transactions for the selected year
    function processForSunburst(records, isExpense) {
        if (!records) return;
        records.forEach(record => {
            const year = new Date(record.TxnDate).getFullYear();
            if (year === targetYear && record.Line) {
                record.Line.forEach(line => {
                    const amt = line.Amount;
                    if (!amt) return;
                    let acctName = "";
                    if (isExpense && line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail.AccountRef) {
                        acctName = line.AccountBasedExpenseLineDetail.AccountRef.name;
                    } else if (!isExpense && line.DetailType === "DepositLineDetail" && line.DepositLineDetail.AccountRef) {
                        acctName = line.DepositLineDetail.AccountRef.name;
                    }

                    // NEW: Grab the date and description for the ledger
                    const date = record.TxnDate;
                    const desc = line.Description || (record.EntityRef ? record.EntityRef.name : "Transaction");

                    if (acctName) addToTree(acctName, amt, isExpense, date, desc);
                });
            }
        });
    }

    processForSunburst(globalData.Deposits, false);
    processForSunburst(globalData.Expenses, true);

    // If there's no data for the year, stop.
    if (rootData.children.length === 0) {
        container.html("<p style='color:#94a3b8; text-align:center; padding-top:50px;'>No data available for this year.</p>");
        return;
    }

    // 2. D3 VISUALIZATION: The Zoomable Sunburst
    const width = container.node().getBoundingClientRect().width || 600;
    const radius = width / 6;

    const hierarchy = d3.hierarchy(rootData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

    const root = d3.partition()
        .size([2 * Math.PI, hierarchy.height + 1])
        (hierarchy);

    root.each(d => d.current = d);

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    const svg = container.append("svg")
        .attr("viewBox", [0, 0, width, width])
        .style("font", "10px sans-serif")
        .style("max-width", "100%")
        .style("height", "auto");

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${width / 2})`);

    const path = g.append("g")
        .selectAll("path")
        .data(root.descendants().slice(1)) // Skip the invisible center root
        .join("path")
        .attr("fill", d => {
            let ancestor = d;
            while (ancestor.depth > 1) ancestor = ancestor.parent;
            const isExp = ancestor.data.name === "Expenses";

            if (d.depth === 1) return isExp ? "#ef4444" : "#10b981";

            let t = (d.x0 - ancestor.x0) / (ancestor.x1 - ancestor.x0);
            let safeT = 0.3 + (t * 0.5);
            return isExp ? d3.interpolateReds(safeT) : d3.interpolateGreens(safeT);
        })
        .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.8 : 0.6) : 0)
        .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
        .attr("d", d => arc(d.current));


    // FIX: Removed the filter so EVERY slice (including leaf nodes) is clickable!
    path.style("cursor", "pointer")
        .on("click", clicked);

    path.on("mouseover", function (event, d) {
        // Add a subtle white border on hover
        d3.select(this).attr("stroke", "#f8fafc").attr("stroke-width", 2);
        tooltip.transition().duration(200).style("opacity", 1);

        const isLeaf = !d.children;
        const percent = d.parent ? ((d.value / d.parent.value) * 100).toFixed(1) : 100;
        const fullPathName = d.ancestors().map(d => d.data.name).reverse().slice(1).join(" → ") || d.data.name;

        // Build the core tooltip header
        let html = `<div style="border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 8px;">
            <span style="font-weight:bold; font-size: 13px; color: #94a3b8;">${fullPathName}</span><br>
            <span style="font-size: 18px; font-weight: 700; color: #f8fafc;">$${d.value.toLocaleString()} Total</span>
        </div>`;

        // If it has a parent, show the percentage share
        if (d.parent) {
            html += `<div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">Share of ${d.parent.data.name}: <b style="color: #f8fafc;">${percent}%</b></div>`;
        }

        // Clean out the old mini-ledger logic and replace it with this:
        if (isLeaf && d.data.txns) {
            html += `<div style="font-size: 11px; font-weight: bold; color: #3b82f6; margin-top: 8px; border-top: 1px dashed #475569; padding-top: 8px; text-align: center; letter-spacing: 0.5px;">
                CLICK TO VIEW FULL LEDGER
            </div>`;
        }

        tooltip.html(html)
            .style("left", () => (event.pageX + 15 + tooltip.node().offsetWidth > window.innerWidth - 20) ? (event.pageX - tooltip.node().offsetWidth - 15) + "px" : (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
    })
        .on("mouseout", function () {
            d3.select(this).attr("stroke", "none"); // Remove the border when mouse leaves
            tooltip.transition().duration(500).style("opacity", 0);
        });

    const label = g.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
        .selectAll("text")
        .data(root.descendants().slice(1))
        .join("text")
        .attr("dy", "0.35em")
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .style("fill", "#f8fafc")
        .style("font-size", "11px")
        .text(d => {
            const name = d.data.name;
            return name.length > 15 ? name.substring(0, 15) + "..." : name;
        });

    const parent = g.append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    // Add center text to explain navigation
    const centerText = g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0em")
        .style("fill", "#94a3b8")
        .style("font-size", "14px")
        .text("Click to Zoom In");

    const centerValue = g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.5em")
        .style("fill", "#f8fafc")
        .style("font-weight", "bold")
        .style("font-size", "16px")
        .text(`$${root.value.toLocaleString()}`);

    function clicked(event, p) {
        // 1. INTERCEPTOR: If it is a leaf node, open the modal instead of zooming!
        if (!p.children) {
            openSunburstModal(p);
            return;
        }

        // 2. DYNAMIC TITLE: Update the breadcrumb header
        const breadcrumbs = p.ancestors().map(d => d.data.name).reverse().join(" → ");
        document.getElementById("sunburst-dynamic-title").innerText = `Overview: ${breadcrumbs}`;

        parent.datum(p.parent || root);

        centerText.text(p.depth === 0 ? "Click to Zoom In" : "Click to Zoom Out");
        centerValue.text(`$${p.value.toLocaleString()}`);

        root.each(d => d.target = {
            // ... (keep your existing coordinate math here)
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = g.transition().duration(750);

        path.transition(t)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function (d) {
                return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
            .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.8 : 0.6) : 0)
            .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
            .attrTween("d", d => () => arc(d.current));

        label.filter(function (d) {
            return +this.getAttribute("fill-opacity") || labelVisible(d.target);
        }).transition(t)
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.05;
    }

    function labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
}

// ==========================================
// SUNBURST MODAL CONTROLS
// ==========================================
window.openSunburstModal = function (node) {
    const modal = document.getElementById("sunburst-modal");
    const tbody = document.getElementById("sunburst-modal-tbody");
    const title = document.getElementById("sunburst-modal-title");
    const subtitle = document.getElementById("sunburst-modal-subtitle");

    if (!modal || !tbody || !title) return;

    // Determine if we should color the amounts red (Expense) or green (Income)
    let ancestor = node;
    while (ancestor.depth > 1) ancestor = ancestor.parent;
    const isExp = ancestor.data.name === "Expenses";
    const amountColor = isExp ? '#ef4444' : '#10b981';

    title.innerText = node.data.name;
    subtitle.innerHTML = `Full Ledger | Total: <b style="color: ${amountColor}">$${node.value.toLocaleString()}</b>`;

    tbody.innerHTML = "";

    if (node.data.txns && node.data.txns.length > 0) {
        // Sort transactions chronologically (newest first)
        let sortedTxns = node.data.txns.sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTxns.forEach(t => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${t.date}</td>
                <td><strong>${t.desc}</strong></td>
                <td style="font-family: monospace; font-size:14px; color:${amountColor};">$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Display the modal using flexbox to keep it perfectly centered
    modal.style.display = "flex";
};

window.closeSunburstModal = function () {
    const modal = document.getElementById("sunburst-modal");
    if (modal) modal.style.display = "none";
};

window.toggleExplainer = function () {
    const el = document.getElementById("data-explainer");
    el.style.display = el.style.display === "none" || el.style.display === "" ? "block" : "none";
};
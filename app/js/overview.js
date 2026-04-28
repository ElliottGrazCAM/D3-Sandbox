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
            <li><strong>Event Totals:</strong> Aggregates any account name containing "Annual Luncheon", "Winter Gala", "Golf Tournament", "Annual Conference", or "Online Event".</li>
            <li><strong>Memberships:</strong> Aggregates accounts starting exactly with <code>"Membership Dues:"</code>.</li>
            <li><strong>Admin Overhead:</strong> Aggregates accounts starting exactly with <code>"Administrative Expenses"</code> or <code>"Software/Communications"</code>.</li>
        </ul>
    `;
    const explainerText = document.getElementById("explainer-text");
    if (explainerText) explainerText.innerHTML = explainerHtml;

    let totalAnnualRev = 0;
    let totalAnnualExp = 0;
    let totalMembersCount = 0;

    // ADDED CONFERENCE AND ONLINE EVENTS HERE
    const events = {
        "Luncheon": { rev: 0, exp: 0 },
        "Winter Gala": { rev: 0, exp: 0 },
        "Golf Tournament": { rev: 0, exp: 0 },
        "Conference": { rev: 0, exp: 0 },
        "Online Events": { rev: 0, exp: 0 }
    };
    const memberships = {};
    const admins = {};

    function processMacroData(records, isExpense) {
        if (!records) return;
        records.forEach(record => {
            const year = new Date(record.TxnDate).getFullYear();
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

                    if (isExpense) totalAnnualExp += amt;
                    else totalAnnualRev += amt;

                    // NEW EVENT LOGIC CAUGHT HERE
                    if (acctName.includes("Annual Luncheon")) {
                        isExpense ? events["Luncheon"].exp += amt : events["Luncheon"].rev += amt;
                    } else if (acctName.includes("Winter Gala")) {
                        isExpense ? events["Winter Gala"].exp += amt : events["Winter Gala"].rev += amt;
                    } else if (acctName.includes("Golf Tournament")) {
                        isExpense ? events["Golf Tournament"].exp += amt : events["Golf Tournament"].rev += amt;
                    } else if (acctName.includes("Annual Conference")) {
                        isExpense ? events["Conference"].exp += amt : events["Conference"].rev += amt;
                    } else if (acctName.startsWith("Online Event")) {
                        // Note: This safely captures both "Online Events" (Revenue) and "Online Event Expenses" (Expense)
                        isExpense ? events["Online Events"].exp += amt : events["Online Events"].rev += amt;
                    }

                    if (acctName.startsWith("Membership Dues") && acctName.includes(":")) {
                        const type = acctName.split(":")[1];
                        if (!memberships[type]) memberships[type] = { type: type, count: 0, revenue: 0 };
                        memberships[type].revenue += amt;
                        memberships[type].count += 1;
                        totalMembersCount += 1;
                    }

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
    d3.select("#ov-total-members").text(totalMembersCount);
    d3.select("#ov-net-income")
        .text(netIncome < 0 ? `-$${Math.abs(netIncome).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `$${netIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)
        .style("color", netIncome < 0 ? "#ef4444" : "#10b981");

    // ==========================================
    // CHART A: EVENT PERFORMANCE
    // ==========================================
    d3.select("#chart-ov-events").html("");
    const eventData = Object.keys(events).map(k => ({ name: k, rev: events[k].rev, exp: events[k].exp }));
    const marginEv = { top: 20, right: 20, bottom: 30, left: 60 }, widthEv = 900 - marginEv.left - marginEv.right, heightEv = 300 - marginEv.top - marginEv.bottom;

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
    // CHART B: MEMBERSHIP BREAKDOWN
    // ==========================================
    d3.select("#chart-ov-members").html("");
    const memData = Object.values(memberships).sort((a, b) => b.revenue - a.revenue);
    if (memData.length > 0) {
        const marginMem = { top: 20, right: 50, bottom: 20, left: 100 }, widthMem = 400 - marginMem.left - marginMem.right, heightMem = 250 - marginMem.top - marginMem.bottom;

        const svgMem = d3.select("#chart-ov-members").append("svg")
            .attr("viewBox", `0 0 ${widthMem + marginMem.left + marginMem.right} ${heightMem + marginMem.top + marginMem.bottom}`)
            .attr("width", "100%")
            .style("height", "auto") // FIXED OVERFLOW BUG
            .attr("preserveAspectRatio", "xMidYMid meet")
            .append("g").attr("transform", `translate(${marginMem.left},${marginMem.top})`);

        const yMem = d3.scaleBand().domain(memData.map(d => d.type)).range([0, heightMem]).padding(0.3);
        const maxMem = d3.max(memData, d => d.revenue) * 1.1 || 1;
        const xMem = d3.scaleLinear().domain([0, maxMem]).range([0, widthMem]);

        svgMem.append("g").call(d3.axisLeft(yMem).tickSize(0)).selectAll("text").style("font-size", "12px").style("fill", "#cbd5e1");
        svgMem.select(".domain").remove();
        svgMem.selectAll("rect").data(memData).enter().append("rect").attr("y", d => yMem(d.type)).attr("x", 0).attr("height", yMem.bandwidth()).attr("width", d => xMem(d.revenue)).attr("fill", "#3b82f6").attr("rx", 3)
            .on("mouseover", function (event, d) {
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`<b>${d.type}s</b><br>Total Members: <b>${d.count}</b><br>Revenue: <span style="color:#3b82f6">$${d.revenue.toLocaleString()}</span>`)
                    .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            }).on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
        svgMem.selectAll(".val-label").data(memData).enter().append("text").attr("y", d => yMem(d.type) + (yMem.bandwidth() / 2) + 4).attr("x", d => xMem(d.revenue) + 5).text(d => `$${d.revenue.toLocaleString()}`).style("fill", "#94a3b8").style("font-size", "11px");
    }

    // ==========================================
    // CHART C: ADMIN & SOFTWARE EXPENSES
    // ==========================================
    d3.select("#chart-ov-admin").html("");
    const adData = Object.keys(admins).map(k => ({ name: k, total: admins[k] })).sort((a, b) => b.total - a.total);
    if (adData.length > 0) {
        const marginAd = { top: 20, right: 50, bottom: 20, left: 120 }, widthAd = 400 - marginAd.left - marginAd.right, heightAd = 250 - marginAd.top - marginAd.bottom;

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
                    .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            }).on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
        svgAd.selectAll(".val-label").data(adData).enter().append("text").attr("y", d => yAd(d.name) + (yAd.bandwidth() / 2) + 4).attr("x", d => xAd(d.total) + 5).text(d => `$${d.total.toLocaleString()}`).style("fill", "#94a3b8").style("font-size", "11px");
    }
}
window.toggleExplainer = function () {
    const el = document.getElementById("data-explainer");
    el.style.display = el.style.display === "none" || el.style.display === "" ? "block" : "none";
};
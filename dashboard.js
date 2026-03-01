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
    // PART 1: THE YoY GROUPED BAR CHART
    // ==========================================
    const yearlyData = {};

    function processYearly(records, type) {
        records.forEach(record => {
            const year = new Date(record.TxnDate).getFullYear().toString();

            if (!yearlyData[year]) {
                yearlyData[year] = { year: year, income: 0, expense: 0 };
            }

            if (type === 'income') {
                record.Line.forEach(line => {
                    yearlyData[year].income += line.Amount;
                });
            }
            if (type === 'expense') {
                yearlyData[year].expense += record.TotalAmt || 0;
            }
        });
    }

    processYearly(luncheonDeposits, 'income');
    processYearly(luncheonExpenses, 'expense');

    const chartData = Object.values(yearlyData).sort((a, b) => a.year.localeCompare(b.year));
    d3.select("#chart-events").html(""); // Clear loading text

    const margin = { top: 40, right: 30, bottom: 50, left: 60 },
        width = 800 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#chart-events")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    const subgroups = ["income", "expense"];
    const x = d3.scaleBand().domain(chartData.map(d => d.year)).range([0, width]).padding(0.2);
    const xSubgroup = d3.scaleBand().domain(subgroups).range([0, x.bandwidth()]).padding(0.05);

    const maxY = d3.max(chartData, d => Math.max(d.income, d.expense)) || 0;
    const y = d3.scaleLinear().domain([0, maxY * 1.1]).nice().range([height, 0]);
    const color = d3.scaleOrdinal().domain(subgroups).range(["#10b981", "#ef4444"]);

    // Draw Axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .selectAll("text")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .attr("transform", "translate(0, 5)");

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => "$" + d.toLocaleString()).ticks(5))
        .select(".domain").remove();

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(5))
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.1);

    // Draw Bars
    const yearGroups = svg.selectAll(".yearGroup")
        .data(chartData).enter().append("g")
        .attr("transform", d => `translate(${x(d.year)},0)`);

    yearGroups.selectAll("rect")
        .data(d => subgroups.map(key => ({ key: key, value: d[key], year: d.year, fullData: d })))
        .enter().append("rect")
        .attr("x", d => xSubgroup(d.key))
        .attr("y", height)
        .attr("width", xSubgroup.bandwidth())
        .attr("height", 0)
        .attr("fill", d => color(d.key))
        .attr("rx", 4)
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong>${d.year} Luncheon</strong>
                <span class="inc">Revenue: $${d.fullData.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span><br>
                <span class="exp">Expenses: $${d.fullData.expense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span><br>
                <hr style="margin:6px 0; border:0; border-top:1px solid #334155;">
                <span style="color:#f8fafc; font-weight:bold;">Net: $${(d.fullData.income - d.fullData.expense).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        })
        .transition().duration(1000).delay((d, i) => i * 100)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${width - 150}, -20)`);
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", "#10b981").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 10).text("Total Revenue").style("font-size", "12px").attr("alignment-baseline", "middle");
    legend.append("rect").attr("x", 0).attr("y", 20).attr("width", 12).attr("height", 12).attr("fill", "#ef4444").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 30).text("Total Expenses").style("font-size", "12px").attr("alignment-baseline", "middle");


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
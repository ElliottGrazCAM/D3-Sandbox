d3.json("data.json").then(data => {

    // ==========================================
    // PART 1: THE D3 BAR CHART
    // ==========================================
    const monthlyData = {};

    function processRecords(records, type) {
        if (!records) return;
        records.forEach(record => {
            const date = new Date(record.TxnDate);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const displayMonth = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = { sortDate: monthYear, display: displayMonth, income: 0, expense: 0 };
            }

            if (type === 'income') {
                record.Line.forEach(line => {
                    if (line.Amount && line.DetailType === "DepositLineDetail") monthlyData[monthYear].income += line.Amount;
                });
            }
            if (type === 'expense') {
                monthlyData[monthYear].expense += record.TotalAmt || 0;
            }
        });
    }

    processRecords(data.Deposits, 'income');
    processRecords(data.Expenses, 'expense');

    const chartData = Object.values(monthlyData).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    d3.select("#chart-events").html("");

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
    const x = d3.scaleBand().domain(chartData.map(d => d.display)).range([0, width]).padding(0.2);
    const xSubgroup = d3.scaleBand().domain(subgroups).range([0, x.bandwidth()]).padding(0.05);

    const maxY = d3.max(chartData, d => Math.max(d.income, d.expense)) || 0;
    const y = d3.scaleLinear().domain([0, maxY * 1.1]).nice().range([height, 0]);
    const color = d3.scaleOrdinal().domain(subgroups).range(["#10b981", "#ef4444"]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "12px");

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => "$" + d.toLocaleString()).ticks(5))
        .select(".domain").remove();

    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(5))
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.1);

    const monthGroups = svg.selectAll(".monthGroup")
        .data(chartData).enter().append("g")
        .attr("transform", d => `translate(${x(d.display)},0)`);

    monthGroups.selectAll("rect")
        .data(d => subgroups.map(key => ({ key: key, value: d[key], display: d.display, fullData: d })))
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
                <strong>${d.display}</strong>
                <span class="inc">Revenue: $${d.fullData.income.toLocaleString()}</span><br>
                <span class="exp">Expenses: $${d.fullData.expense.toLocaleString()}</span><br>
                <hr style="margin:6px 0; border:0; border-top:1px solid #334155;">
                <span style="color:#f8fafc; font-weight:bold;">Net: $${(d.fullData.income - d.fullData.expense).toLocaleString()}</span>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        })
        .transition().duration(1000).delay((d, i) => i * 50)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));

    const legend = svg.append("g").attr("transform", `translate(${width - 150}, -20)`);
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", "#10b981").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 10).text("Event Revenue").style("font-size", "12px").attr("alignment-baseline", "middle");
    legend.append("rect").attr("x", 0).attr("y", 20).attr("width", 12).attr("height", 12).attr("fill", "#ef4444").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 30).text("Event Expenses").style("font-size", "12px").attr("alignment-baseline", "middle");


    // ==========================================
    // PART 2: KPIs AND SORTABLE TABLE
    // ==========================================
    let totalRegistrants = 0;
    let totalSponsors = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    const tableRows = [];

    // Process Income for Table
    if (data.Deposits) {
        data.Deposits.forEach(record => {
            const date = record.TxnDate;
            record.Line.forEach(line => {
                if (line.Amount && line.DetailType === "DepositLineDetail") {
                    totalIncome += line.Amount;

                    // Production-grade categorization based on QBO Account Name
                    let accountName = "";
                    if (line.DepositLineDetail && line.DepositLineDetail.AccountRef) {
                        accountName = line.DepositLineDetail.AccountRef.name || "";
                    }

                    const isSponsor = accountName.toLowerCase().includes("sponsor");
                    if (isSponsor) totalSponsors++; else totalRegistrants++;

                    const typeClass = isSponsor ? 'sponsor' : 'registrant';
                    const typeLabel = isSponsor ? 'Sponsor' : 'Registrant';

                    // Try to get Name, fallback to Description
                    let name = "Online Contributor";
                    if (line.Entity?.EntityRef?.name) name = line.Entity.EntityRef.name;
                    else if (line.Description) name = line.Description;

                    tableRows.push({
                        date: date,
                        name: name,
                        typeHTML: `<span class="badge ${typeClass}">${typeLabel}</span>`,
                        amount: line.Amount,
                        rawType: typeLabel
                    });
                }
            });
        });
    }

    // Process Expenses for Table
    if (data.Expenses) {
        data.Expenses.forEach(record => {
            const date = record.TxnDate;
            const name = record.EntityRef?.name || "Vendor";
            totalExpense += record.TotalAmt || 0;

            tableRows.push({
                date: date,
                name: name,
                typeHTML: `<span class="badge expense">Expense</span>`,
                amount: record.TotalAmt || 0,
                rawType: "Expense"
            });
        });
    }

    // Update the KPI Cards in HTML
    document.getElementById("kpi-registrants").innerText = totalRegistrants.toLocaleString();
    document.getElementById("kpi-sponsors").innerText = totalSponsors.toLocaleString();
    document.getElementById("kpi-net").innerText = "$" + (totalIncome - totalExpense).toLocaleString(undefined, { minimumFractionDigits: 2 });

    // Populate Table (Default sort: Newest First)
    tableRows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById("txn-tbody");
    tableRows.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row.date}</td>
            <td><strong>${row.name}</strong></td>
            <td>${row.typeHTML}</td>
            <td style="font-family: monospace; font-size:14px;">$${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(tr);
    });

}).catch(error => {
    console.error("Error loading data:", error);
    d3.select("#chart-events").html("<p style='color:red;'>Waiting for data...</p>");
});

// ==========================================
// PART 3: THE SORTING FUNCTION
// ==========================================
let sortDirection = false;
function sortTable(columnIndex) {
    const table = document.getElementById("txn-table");
    const rows = Array.from(table.rows).slice(1); // Exclude header
    sortDirection = !sortDirection;

    rows.sort((a, b) => {
        let cellA = a.cells[columnIndex].innerText.replace(/[^0-9a-zA-Z.-]+/g, "");
        let cellB = b.cells[columnIndex].innerText.replace(/[^0-9a-zA-Z.-]+/g, "");

        // If numeric, sort by numbers. If text, sort alphabetically.
        if (!isNaN(cellA) && !isNaN(cellB)) {
            return sortDirection ? cellA - cellB : cellB - cellA;
        }
        return sortDirection ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    const tbody = document.getElementById("txn-tbody");
    rows.forEach(row => tbody.appendChild(row));
}
d3.json("data.json").then(data => {

    // 1. Process and Group the Raw Transactions by Month
    const monthlyData = {};

    // Helper to group data
    function processRecords(records, type) {
        if (!records) return;
        records.forEach(record => {
            const date = new Date(record.TxnDate);
            // Format as YYYY-MM
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const displayMonth = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = { sortDate: monthYear, display: displayMonth, income: 0, expense: 0 };
            }

            // Sum up the line items
            record.Line.forEach(line => {
                if (line.Amount) {
                    if (type === 'income') monthlyData[monthYear].income += line.Amount;
                    if (type === 'expense') monthlyData[monthYear].expense += line.Amount;
                }
            });
        });
    }

    processRecords(data.Deposits, 'income');
    processRecords(data.Expenses, 'expense');

    // Convert to a sorted array
    const chartData = Object.values(monthlyData).sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    // Clear loading text
    d3.select("#chart-events").html("");

    // 2. Setup D3 Dimensions
    const margin = { top: 40, right: 30, bottom: 50, left: 60 },
        width = 800 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#chart-events")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add a Tooltip div to the body
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    // 3. Create Scales
    const subgroups = ["income", "expense"];
    const x = d3.scaleBand().domain(chartData.map(d => d.display)).range([0, width]).padding(0.2);
    const xSubgroup = d3.scaleBand().domain(subgroups).range([0, x.bandwidth()]).padding(0.05);

    const maxY = d3.max(chartData, d => Math.max(d.income, d.expense)) || 0;
    const y = d3.scaleLinear().domain([0, maxY * 1.1]).nice().range([height, 0]);

    const color = d3.scaleOrdinal().domain(subgroups).range(["#10b981", "#ef4444"]); // Green and Red

    // 4. Draw Axes
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

    // Add grid lines
    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(5))
        .style("stroke-dasharray", "3,3")
        .style("opacity", 0.1);

    // 5. Draw the Animated Bars
    const monthGroups = svg.selectAll(".monthGroup")
        .data(chartData)
        .enter()
        .append("g")
        .attr("transform", d => `translate(${x(d.display)},0)`);

    monthGroups.selectAll("rect")
        .data(d => subgroups.map(key => ({ key: key, value: d[key], display: d.display, fullData: d })))
        .enter().append("rect")
        .attr("x", d => xSubgroup(d.key))
        .attr("y", height) // Start at the bottom for animation
        .attr("width", xSubgroup.bandwidth())
        .attr("height", 0) // Start with 0 height
        .attr("fill", d => color(d.key))
        .attr("rx", 4) // Rounded corners

        // --- TOOLTIP LOGIC ---
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong>${d.display}</strong>
                <span class="inc">Revenue: $${d.fullData.income.toLocaleString()}</span><br>
                <span class="exp">Expenses: $${d.fullData.expense.toLocaleString()}</span><br>
                <hr style="margin:6px 0; border:0; border-top:1px solid #eee;">
                <span style="color:#3b82f6; font-weight:bold;">Net: $${(d.fullData.income - d.fullData.expense).toLocaleString()}</span>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        })

        // --- SMOOTH TRANSITION ---
        .transition()
        .duration(1000)
        .delay((d, i) => i * 50) // Stagger the animation slightly
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));

    // 6. Add a Legend
    const legend = svg.append("g").attr("transform", `translate(${width - 150}, -20)`);

    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", "#10b981").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 10).text("Event Revenue").style("font-size", "12px").attr("alignment-baseline", "middle");

    legend.append("rect").attr("x", 0).attr("y", 20).attr("width", 12).attr("height", 12).attr("fill", "#ef4444").attr("rx", 2);
    legend.append("text").attr("x", 20).attr("y", 30).text("Event Expenses").style("font-size", "12px").attr("alignment-baseline", "middle");

}).catch(error => {
    console.error("Error loading data:", error);
    d3.select("#chart-events").html("<p style='color:red;'>Waiting for data...</p>");
});
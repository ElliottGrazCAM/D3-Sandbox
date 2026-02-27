d3.json("data.json").then(data => {

    // 1. Helper function
    function findValue(rows, targetName) {
        let foundValue = 0;
        function search(rowArray) {
            if (!rowArray) return;
            for (let r of rowArray) {
                if (r.Summary && r.Summary.ColData && r.Summary.ColData[0].value === targetName) {
                    foundValue = parseFloat(r.Summary.ColData[1].value);
                }
                if (r.Rows && r.Rows.Row) search(r.Rows.Row);
            }
        }
        search(rows);
        return foundValue;
    }

    // 2. Extract Data
    const allRows = data.Rows.Row;
    const chartData = [
        { category: "Total Income", value: findValue(allRows, "Total Income"), color: "#10b981" },   // Modern Green
        { category: "Total Expenses", value: findValue(allRows, "Total Expenses"), color: "#ef4444" }, // Modern Red
        { category: "Net Income", value: findValue(allRows, "Net Income"), color: "#3b82f6" }          // Modern Blue
    ];

    // 3. Set up Dimensions (Responsive viewBox)
    const margin = { top: 20, right: 20, bottom: 40, left: 60 },
        width = 500 - margin.left - margin.right,
        height = 350 - margin.top - margin.bottom;

    const svg = d3.select("#chart-pnl")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 4. Scales & Axes
    const x = d3.scaleBand().domain(chartData.map(d => d.category)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.1]).nice().range([height, 0]);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickSize(0)).select(".domain").remove();
    svg.append("g").call(d3.axisLeft(y).tickFormat(d => "$" + d.toLocaleString())).select(".domain").remove();

    // 5. Draw Bars & Labels
    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("class", "bar").attr("x", d => x(d.category)).attr("y", d => y(d.value))
        .attr("width", x.bandwidth()).attr("height", d => height - y(d.value))
        .attr("fill", d => d.color).attr("rx", 4);

    svg.selectAll(".label").data(chartData).enter().append("text")
        .attr("class", "label").attr("x", d => x(d.category) + x.bandwidth() / 2).attr("y", d => y(d.value) + 20)
        .text(d => "$" + d.value.toLocaleString());

}).catch(error => {
    console.error("Error loading data:", error);
    d3.select("#chart-pnl").html("<p style='color:red;'>Waiting for data...</p>");
});
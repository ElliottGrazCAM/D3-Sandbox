let globalData = null;
let usStatesData = null;
let currentYear = parseInt(document.getElementById("map-year-slider").value) || 2025;

const tooltip = d3.select("body").append("div").attr("class", "tooltip").style("pointer-events", "none");

// Dictionary to translate your PrivateNote abbreviations into the full names D3 understands
const stateDictionary = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
};

// ==========================================
// 1. SETUP SVG AND LAYERS (Z-INDEX FIX)
// ==========================================
const mapContainer = d3.select("#chart-mem-map");
mapContainer.html("");

const mapWidth = mapContainer.node().getBoundingClientRect().width || 900;
const mapHeight = 500;

const svgMap = mapContainer.append("svg")
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("display", "block");

// SCALE FIX: Scaled down by 15% (0.85) to fit container safely without cutting off
const projection = d3.geoAlbersUsa()
    .translate([mapWidth / 2, mapHeight / 2])
    .scale(mapWidth * 0.85);

const pathGenerator = d3.geoPath().projection(projection);

// LAYER FIX: We explicitly create two layers so the bubbles ALWAYS render on top of the states
const stateLayer = svgMap.append("g").attr("id", "state-layer");
const bubbleLayer = svgMap.append("g").attr("id", "bubble-layer");

// ==========================================
// 2. LOAD DATA AND INITIALIZE
// ==========================================
Promise.all([
    d3.json("us-states.json"),
    d3.json(`data.json?v=${new Date().getTime()}`)
]).then(([states, data]) => {
    usStatesData = states;
    globalData = data;

    // Draw the solid state background ONCE on the bottom layer
    stateLayer.selectAll("path")
        .data(usStatesData.features)
        .enter().append("path")
        .attr("d", pathGenerator)
        .attr("fill", "#1e293b")
        .attr("stroke", "#334155")
        .attr("stroke-width", 1);

    // Setup the Slider
    const slider = document.getElementById("map-year-slider");
    if (slider) {
        slider.addEventListener("input", function (e) {
            currentYear = parseInt(e.target.value);
            document.getElementById("map-year-display").innerText = currentYear;
            renderMapBubbles();
            renderBreakdownChart();
        });
    }

    renderMapBubbles();
    renderBreakdownChart();

}).catch(error => console.error("Error loading data:", error));


// ==========================================
// 3. RENDER THE BUBBLES
// ==========================================
function renderMapBubbles() {
    const stateTotals = {};
    let topStateName = "--";
    let topStateCount = 0;

    if (globalData && globalData.Deposits) {
        globalData.Deposits.forEach(record => {
            const year = new Date(record.TxnDate).getFullYear();
            if (year === currentYear && record.PrivateNote) {
                // Scrape the state abbreviation from the note
                const match = record.PrivateNote.match(/Geo:\s*([A-Z]{2})/i);
                if (match && match[1]) {
                    const abbrev = match[1].toUpperCase();
                    const fullName = stateDictionary[abbrev];
                    if (fullName) {
                        stateTotals[fullName] = (stateTotals[fullName] || 0) + 1;
                        if (stateTotals[fullName] > topStateCount) {
                            topStateCount = stateTotals[fullName];
                            topStateName = fullName;
                        }
                    }
                }
            }
        });
    }

    // Update Top State KPI
    const topStateEl = document.getElementById("mem-top-state");
    if (topStateEl) topStateEl.innerText = topStateCount > 0 ? `${topStateName} (${topStateCount})` : "--";

    // Set bubble scale limits
    const maxMembers = Math.max(...Object.values(stateTotals), 1);
    const rScale = d3.scaleSqrt().domain([0, maxMembers]).range([0, 30]);

    // Draw bubbles on the dedicated TOP layer!
    const bubbles = bubbleLayer.selectAll(".mem-bubble")
        .data(usStatesData.features, d => d.properties.name);

    bubbles.join(
        enter => enter.append("circle")
            .attr("class", "mem-bubble")
            .attr("cx", d => {
                const centroid = pathGenerator.centroid(d);
                return (centroid && !isNaN(centroid[0])) ? centroid[0] : -100;
            })
            .attr("cy", d => {
                const centroid = pathGenerator.centroid(d);
                return (centroid && !isNaN(centroid[1])) ? centroid[1] : -100;
            })
            .attr("r", 0)
            .attr("fill", "rgba(59, 130, 246, 0.6)")
            .attr("stroke", "#60a5fa")
            .attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("mouseover", function (event, d) {
                const count = stateTotals[d.properties.name] || 0;
                if (count === 0) return;

                d3.select(this).attr("stroke-width", 2).attr("fill", "rgba(59, 130, 246, 0.9)");
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`<div style="font-weight:bold; font-size:14px; color: #f8fafc;">${d.properties.name}</div><div style="color:#94a3b8; margin-top:4px;">Active Members: <b style="color:#3b82f6">${count}</b></div>`)
                    .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke-width", 1).attr("fill", "rgba(59, 130, 246, 0.6)");
                tooltip.transition().duration(500).style("opacity", 0);
            })
            .call(enter => enter.transition().duration(500)
                .attr("r", d => rScale(stateTotals[d.properties.name] || 0))
            ),
        update => update
            .call(update => update.transition().duration(500)
                .attr("r", d => rScale(stateTotals[d.properties.name] || 0))
            ),
        exit => exit.remove()
    );
}

// ==========================================
// 4. MEMBERSHIP TIER BREAKDOWN
// ==========================================
function renderBreakdownChart() {
    d3.select("#chart-mem-breakdown").html("");
    let totalRev = 0;
    let totalMembers = 0;
    const memberships = {};

    if (globalData && globalData.Deposits) {
        globalData.Deposits.forEach(record => {
            const year = new Date(record.TxnDate).getFullYear();
            if (year === currentYear && record.Line) {
                record.Line.forEach(line => {
                    const amt = line.Amount;
                    if (!amt) return;

                    let acctName = "";
                    if (line.DetailType === "DepositLineDetail" && line.DepositLineDetail.AccountRef) {
                        acctName = line.DepositLineDetail.AccountRef.name || "";
                    }

                    if (acctName.startsWith("Membership Dues") && acctName.includes(":")) {
                        const type = acctName.split(":")[1];
                        if (!memberships[type]) memberships[type] = { type: type, count: 0, revenue: 0 };
                        memberships[type].revenue += amt;
                        memberships[type].count += 1;
                        totalMembers += 1;
                        totalRev += amt;
                    }
                });
            }
        });
    }

    // Update Top KPIs
    const countEl = document.getElementById("mem-total-count");
    const revEl = document.getElementById("mem-total-rev");
    if (countEl) countEl.innerText = totalMembers;
    if (revEl) revEl.innerText = `$${totalRev.toLocaleString()}`;

    const memData = Object.values(memberships).sort((a, b) => b.revenue - a.revenue);
    if (memData.length === 0) {
        d3.select("#chart-mem-breakdown").html("<p style='color:#94a3b8; text-align:center; padding-top:50px;'>No membership data found for this year.</p>");
        return;
    }

    const marginMem = { top: 10, right: 60, bottom: 20, left: 120 };
    const widthMem = 600 - marginMem.left - marginMem.right;
    const heightMem = 350 - marginMem.top - marginMem.bottom;

    const svgMem = d3.select("#chart-mem-breakdown").append("svg")
        .attr("viewBox", `0 0 ${widthMem + marginMem.left + marginMem.right} ${heightMem + marginMem.top + marginMem.bottom}`)
        .attr("width", "100%")
        .style("height", "auto")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g").attr("transform", `translate(${marginMem.left},${marginMem.top})`);

    const yMem = d3.scaleBand().domain(memData.map(d => d.type)).range([0, heightMem]).padding(0.3);
    const maxMem = d3.max(memData, d => d.revenue) * 1.1 || 1;
    const xMem = d3.scaleLinear().domain([0, maxMem]).range([0, widthMem]);

    svgMem.append("g").call(d3.axisLeft(yMem).tickSize(0)).selectAll("text").style("font-size", "13px").style("fill", "#cbd5e1");
    svgMem.select(".domain").remove();

    svgMem.selectAll("rect").data(memData).enter().append("rect")
        .attr("y", d => yMem(d.type)).attr("x", 0).attr("height", yMem.bandwidth()).attr("width", d => xMem(d.revenue))
        .attr("fill", "#3b82f6").attr("rx", 3)
        .on("mouseover", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<b>${d.type}s</b><br>Total Members: <b>${d.count}</b><br>Revenue: <span style="color:#3b82f6">$${d.revenue.toLocaleString()}</span>`)
                .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        }).on("mouseout", function () {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    svgMem.selectAll(".val-label").data(memData).enter().append("text")
        .attr("y", d => yMem(d.type) + (yMem.bandwidth() / 2) + 4)
        .attr("x", d => xMem(d.revenue) + 5)
        .text(d => `$${d.revenue.toLocaleString()}`)
        .style("fill", "#94a3b8").style("font-size", "12px").style("font-weight", "bold");
}
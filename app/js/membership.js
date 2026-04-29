// ==========================================
// BARE-BONES MAP DIAGNOSTIC TEST
// ==========================================

// 1. Set up the canvas
const mapContainer = d3.select("#chart-mem-map");
mapContainer.html(""); // Clear out any old errors or HTML

const mapWidth = mapContainer.node().getBoundingClientRect().width || 1000;
const mapHeight = 600;

const svgMap = mapContainer.append("svg")
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("display", "block");

// 2. Set up the geographic math
// AlbersUSA automatically handles curving the map and moving AK/HI
const projection = d3.geoAlbersUsa()
    .translate([mapWidth / 2, mapHeight / 2])
    .scale(mapWidth); // Backed the scale down slightly to ensure it fits on screen

const pathGenerator = d3.geoPath().projection(projection);

// 3. Fetch ONLY the map file and draw it
d3.json("us-states.json").then(usStatesData => {
    console.log("SUCCESS: us-states.json loaded!", usStatesData);

    svgMap.append("g")
        .selectAll("path")
        .data(usStatesData.features)
        .enter().append("path")
        .attr("d", pathGenerator)
        .attr("fill", "#1e293b")   // Dark slate blue
        .attr("stroke", "#94a3b8") // Light gray borders so you can easily see them
        .attr("stroke-width", 1);

}).catch(error => {
    console.error("CRITICAL ERROR: Could not find or parse us-states.json", error);
    mapContainer.html(`<p style="color:#ef4444; text-align:center; margin-top:50px;">
        <b>Error loading us-states.json.</b><br>
        Check your browser's Developer Console (F12) for the exact file path error.
    </p>`);
});
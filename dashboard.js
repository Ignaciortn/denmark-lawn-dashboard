// Google Sheet URLs
const DAILY_OPS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWUHjuqCzbo5eG0-NlrjNnuLkyBThem6Vlz0OnZ_ZaLr-wq90_WGNohviZvpx8jmNg4WpXBuhaSAJ9/pub?gid=0&single=true&output=csv";

const WEEKLY_FACT_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWUHjuqCzbo5eG0-NlrjNnuLkyBThem6Vlz0OnZ_ZaLr-wq90_WGNohviZvpx8jmNg4WpXBuhaSAJ9/pub?gid=2058229020&single=true&output=csv";

const TARGETS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWUHjuqCzbo5eG0-NlrjNnuLkyBThem6Vlz0OnZ_ZaLr-wq90_WGNohviZvpx8jmNg4WpXBuhaSAJ9/pub?gid=186783136&single=true&output=csv";

const REVENUE_LY_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWUHjuqCzbo5eG0-NlrjNnuLkyBThem6Vlz0OnZ_ZaLr-wq90_WGNohviZvpx8jmNg4WpXBuhaSAJ9/pub?gid=631839392&single=true&output=csv";


let monthlyTargetChart = null;
let revenueVsLYMonthlyChart = null;

// Parse CSV text into an array of objects
function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, "").trim());
    return lines.slice(1).map(line => {
        const values = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === "," && !inQuotes) {
                values.push(current.trim());
                current = "";
            } else {
                current += line[i];
            }
        }
        values.push(current.trim());
        const row = {};

        headers.forEach((header, idx) => {
            let val = values[idx] ? values[idx].replace(/[$,%]/g, "").trim() : "0";
            if (val.startsWith("(") && val.endsWith(")")) {
                val = "-" + val.slice(1, -1);
            }
            row[header] = val;
        });
        return row;
    });
}

// Get the most recent week with data
function getMostRecentWeek(weeklyData) {
    const today = new Date();
    const withData = weeklyData.filter(row => {
        if (!row.WeekStart || row.WeekStart === "0" || row.WeekStart === "") return false;
        const weekStart = new Date(row.WeekStart);
        const weekEnd = new Date(row.WeekEnd);
        return weekStart <= today && weekEnd >= today;
    });
    if (withData.length > 0) return withData[0];

    const allValid = weeklyData.filter(row=> row.WeekStart && row.WeekStart !== "0");
    allValid.sort((a, b) => new Date(b.WeekStart) - new Date(a.WeekStart));
    return allValid[0];
}

function getCurrentMonthTarget(targetsData, date) {
    const d = new Date(date);
    const monthKey = d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0");
    return targetsData.find(row => row.Month === monthKey) || null;
}

// Format numbers as currency
function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(value);
}

function countWorkingDays(start, end) {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// Renders monthly target charts
function renderMonthlyTargetChart(dailyData, targetsData) {
    const monthTotals = {};

    dailyData.forEach(row => {
        if (!row.Date || row.Date === "0" || row.Date === "") return;
        
        const date = new Date(row.Date);
        if (isNaN(date)) return;

        const monthKey = date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0");
        
        const revenue = parseFloat(row.GrossRevenue) || 0;
        monthTotals[monthKey] = (monthTotals[monthKey] || 0) + revenue;
    });

    const sortedMonths = Object.keys(monthTotals).sort();

    const actualData = sortedMonths.map(m => monthTotals[m]);
    const minData = sortedMonths.map(m => {
        const target = targetsData.find(row => row.Month === m);
        return target ? parseFloat(target.MinTarget_GrossRevenue) || 0 : 0;
    });

    const goalData = sortedMonths.map(m => {
        const target = targetsData.find(row => row.Month === m);
        return target ? parseFloat(target.GoalTarget_GrossRevenue) || 0 : 0;
    });

    const ctx = document.getElementById("monthlyTargetChart").getContext("2d");

    if (monthlyTargetChart) {
        monthlyTargetChart.destroy();
    }

    monthlyTargetChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: "Actual Revenue",
                    data: actualData,
                    backgroundColor: "#2D5F2E",
                    borderColor: "#2D5F2E",
                    borderWidth: 2
                },
                {
                    label: "Min Target",
                    data: minData,
                    type: "line",
                    borderColor: "#ffaa00",
                    borderWidth: 2,
                    pointRadius: 4,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: "Goal Target",
                    data: goalData,
                    type: "line",
                    borderColor: "#5B2D8E",
                    borderWidth: 2,
                    pointRadius: 4,
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: { labels: {color: "#222222" } },
                tooltip: {
                    mode: "index",
                    intersect: false
                }
            },
            scales: {
                x: { ticks: { color: "#555555" } },
                y: {
                    ticks: {
                        color: "#555555",
                        callback: value => "$" + value.toLocaleString()
                    }
                }
            }
        }
    });
}

// Renders monthly comparison chart - This Year vs Last Year (Monthly)
function renderRevenueVsLYMonthlyChart(dailyData, lyData) {
    // Calculate this year's montly totals from Daily_Operations
    const monthTotals = {};
    dailyData.forEach(row => {
        if (!row.Date || row.Date === "0" || row.Date === "") return;

        const date = new Date(row.Date);

        if (isNaN(date)) return;

        const monthKey = date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0");
        const revenue = parseFloat(row.GrossRevenue) || 0;
        monthTotals[monthKey] = (monthTotals[monthKey] || 0) + revenue;   
    });

    // Get this year's months
    const thisYearMonths = Object.keys(monthTotals)
        .filter(m => m.startsWith("2026"))
        .sort();

    // Match with last year's data
    const thisYearData = thisYearMonths.map(m => monthTotals[m] || 0);
    const lastYearData = thisYearMonths.map(m => {
        const lyMonth = (parseInt(m.split("-")[0]) - 1) + "-" + m.split("-")[1];
        const lyRow = lyData.find(row => row.Month === lyMonth);
        return lyRow ? parseFloat(lyRow.GrossRevenue_LY) || 0 : 0;
    });
    
    const labels = thisYearMonths.map(m => {
        //const date = new Date(m + "-01");
        //return date.toLocaleString("en-US", { month: "short"}) + " " + m.split("-")[0];
        const parts = m.split("-");
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        return date.toLocaleString("en-US", { month: "short"}) + " " + parts[0];
    });

    const ctx = document.getElementById("revenueVsLYMonthlyChart").getContext("2d");

    if (revenueVsLYMonthlyChart) {
        revenueVsLYMonthlyChart.destroy();
    }

    revenueVsLYMonthlyChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "This Year (2026)",
                    data: thisYearData,
                    backgroundColor: "#2D5F2E",
                    borderColor: "#2D5F2E",
                    borderWidth: 2
                },
                {
                    label: "Last Year (2025)",
                    data: lastYearData,
                    backgroundColor: "#7B5EA7",
                    borderColor: "#7B5EA7",
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: { labels: {color: "#222222" } },
                tooltip: {
                    mode: "index",
                    intersect: false
                }
            },
            scales: {
                x: { ticks: { color: "#555555" } },
                y: {
                    ticks: {
                        color: "#555555",
                        callback: value => "$" + value.toLocaleString()
                    }
                }
            } 
        }
    });
}

// Updates the monthly revenue progress bar
// Shows actual revenue progress toward min and goal targets
// Green bar = actual revenue, Yellow line = min target, Purple line = goal target
function updateProgressBar(monthRevenue, minTarget, goalTarget) {
    const percent = goalTarget > 0 ? (monthRevenue / goalTarget) * 100 : 0;
    const minPercent = goalTarget > 0 ? (minTarget / goalTarget) * 100 : 0;

    document.getElementById("progressPercent").textContent =
        percent.toFixed(1) + "% of Goal";

    document.getElementById("progressBarActual").style.width =
        Math.min(percent, 100) + "%";
    
    document.getElementById("progressBarMin").style.left =
        Math.min(minPercent, 100) + "%";
    
    document.getElementById("progressBarGoal").style.left = "99%";        
}

// Main function to fetch and display data
async function fetchData() {
    try {
        // Fetch both sheets at the same time
        const [dailyRes, weeklyRes, targetsRes, lyRes] = await Promise.all([
            fetch(DAILY_OPS_URL),
            fetch(WEEKLY_FACT_URL),
            fetch(TARGETS_URL),
            fetch(REVENUE_LY_URL)
        ]);

        const dailyText = await dailyRes.text();
        const weeklyText = await weeklyRes.text();
        const targetsText = await targetsRes.text();
        const lyText = await lyRes.text();

        const dailyData = parseCSV(dailyText);
        const weeklyData = parseCSV(weeklyText);
        const targetsData = parseCSV(targetsText);
        const lyData = parseCSV(lyText);

        const today = new Date();
        const currentWeek = getMostRecentWeek(weeklyData);
        const weekRevenue = parseFloat(currentWeek.GrossRevenue_Week) || 0;
        const currentTarget = getCurrentMonthTarget(targetsData, today);

        console.log("Daily Data:", dailyData[0]);
        console.log("Weekly Data:", weeklyData[0]);
        console.log("All weeks:", weeklyData.map(row => row.WeekStart));
        console.log("Current Week:", currentWeek);
        console.log("Targets Data:", targetsData[0]);
        console.log("Current Target:", currentTarget);
        console.log("LY Data:", lyData[0]);

        // Calculate month to date revenue from daily data
        const weekStart = new Date(currentWeek.WeekStart);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = today;

        console.log("First daily row:", dailyData[0]);
        console.log("First date value:", dailyData[0].Date);
        console.log("Parsed date:", new Date(dailyData[0].Date));

        const monthRevenue = dailyData
            .filter(row => {
                const date = new Date(row.Date);
                return date >= monthStart && date <= today;
            })
            .reduce((sum, row) => {
                const val = parseFloat(row.GrossRevenue) || 0;
                return sum + val;
            }, 0);

        console.log("Today:", today);
        console.log("Month Start:", monthStart);
        console.log("Sample daily date;", new Date(dailyData[100].Date));


        console.log("April rows:", dailyData.filter(row => {
            const date = new Date(row.Date);
            return date >= monthStart && date <= today;
        }));

        // Monthly targets
        const goalTarget = currentTarget ? parseFloat(currentTarget.GoalTarget_GrossRevenue) : 0;
        const minTarget = currentTarget ? parseFloat(currentTarget.MinTarget_GrossRevenue) : 0;

        // Calculating working days for status
        const monthStart2 = new Date(weekStart.getFullYear(), today.getMonth(), 1);
        const monthEnd2 = new Date(weekStart.getFullYear(), today.getMonth() + 1, 0);
        const workingDaysTotal = countWorkingDays(monthStart2, monthEnd2);
        const workingDaysSoFar = countWorkingDays(monthStart2, today);
        const proratedTarget = (goalTarget / workingDaysTotal) * workingDaysSoFar;

        // Set Status
        let status = "Behind";
        if (monthRevenue >= goalTarget) status = "Goal Hit!";
        else if (monthRevenue >= minTarget) status = "Min Goal Hit";
        else if (monthRevenue >= proratedTarget) status = "On Track";

        // Update progress bar
        updateProgressBar(monthRevenue, minTarget, goalTarget);

        // Populate KPI cards
        document.getElementById("grossRevenue").textContent =
            formatCurrency(weekRevenue);

        document.getElementById("monthTarget").textContent =
            formatCurrency(goalTarget);

        document.getElementById("monthRevenue").textContent =
            formatCurrency(monthRevenue);

        // Update last updated timestamp
        document.getElementById("lastUpdated").textContent =
            "Last updated: " + new Date().toLocaleString();

        document.getElementById("status").textContent = status;

        // Render charts
        renderMonthlyTargetChart(dailyData, targetsData);
        renderRevenueVsLYMonthlyChart(dailyData, lyData);

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Run on page load
fetchData();

// Auto refresh every 60 seconds
setInterval(fetchData, 60000);

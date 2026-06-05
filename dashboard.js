// Google Sheet URLs
const DAILY_OPS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWUHjuqCzbo5eG0-NlrjNnuLkyBThem6Vlz0OnZ_ZaLr-wq90_WGNohviZvpx8jmNg4WpXBuhaSAJ9/pub?gid=0&single=true&output=csv";

const WEEKLY_FACT_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWUHjuqCzbo5eG0-NlrjNnuLkyBThem6Vlz0OnZ_ZaLr-wq90_WGNohviZvpx8jmNg4WpXBuhaSAJ9/pub?gid=2058229020&single=true&output=csv";

const TARGETS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWUHjuqCzbo5eG0-NlrjNnuLkyBThem6Vlz0OnZ_ZaLr-wq90_WGNohviZvpx8jmNg4WpXBuhaSAJ9/pub?gid=186783136&single=true&output=csv";

let weeklyRevenueChart = null;
let monthlyRevenueChart = null;
let revenueVsLYChart = null;
let monthlyTargetChart = null;


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
    const withData = weeklyData.filter(row => {
        return row.WeekStart && row.WeekStart !== "0" && row.WeekStart !== "";
    });
    withData.sort((a, b) => new Date(b.WeekStart) - new Date(a.WeekStart));
    return withData[0];
}

function getCurrentMonthTarget(targetsData, weekStart) {
    const date = new Date(weekStart);
    const monthKey = date.getFullYear() + "-" +
        String(date.getMonth() + 1).padStart(2, "0");
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

// Render the weekly, monthly, revenue vs Last Year, and monthly target charts
function renderWeeklyRevenueChart(weeklyData) {
    const validWeeks = weeklyData.filter(row => {
        const revenue = parseFloat(row.GrossRevenue_Week);
        return row.WeekStart && row.WeekStart !== "0" && !isNaN(revenue) && revenue > 0;
    });

    validWeeks.sort((a, b) => new Date(a.WeekStart) - new Date(b.WeekStart));

    const labels = validWeeks.map(row => row.WeekStart);
    const data = validWeeks.map(row => parseFloat(row.GrossRevenue_Week));

    const ctx = document.getElementById("weeklyRevenueChart").getContext("2d");

    if (weeklyRevenueChart) {
        weeklyRevenueChart.destroy();
    }

    weeklyRevenueChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Gross Revenue",
                data: data,
                borderColor: "#2D5F2E",
                backgroundColor: "rgba(45, 95, 46, 0.2)",
                borderWidth: 2,
                pointBackgroundColor: "#5B2D8E",
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }]            
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: {color: "222222" } }
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

function renderMonthlyRevenueChart(dailyData) {
    const monthTotals = {};

    dailyData.forEach(row => {
        if (!row.Date ||row.Date === "0" || row.Date === "") return;
        const date = new Date(row.Date);

        if(isNaN(date)) return;
        const monthKey = date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0");
        const revenue = parseFloat(row.GrossRevenue) || 0;

        monthTotals[monthKey] = (monthTotals[monthKey] || 0) + revenue;
    });

    const sortedMonths = Object.keys(monthTotals).sort();
    const labels = sortedMonths;
    const data = sortedMonths.map(m => monthTotals[m]);

    const ctx = document.getElementById("monthlyRevenueChart").getContext("2d");

    if (monthlyRevenueChart) {
        monthlyRevenueChart.destroy();
    }

    monthlyRevenueChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Monthly Gross Revenue",
                data: data,
                backgroundColor: "#7B5EA7",
                borderColor: "#5B2D8E",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: {color: "#222222"} }
            },
            scales: {
                x: { ticks: { color: "#555555"} },
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

function renderRevenueVsLYChart(weeklyData) {
    const validWeeks = weeklyData.filter(row => {
        const revenue = parseFloat(row.GrossRevenue_Week);
        const lyRevenue = parseFloat(row.Revenue_LY);

        return row.WeekStart && 
            row.WeekStart !== "0" &&
            !isNaN(revenue) &&
            revenue > 0 &&
            !isNaN(lyRevenue) &&
            lyRevenue > 0; 
    });

    console.log("Valid weeks for LY chart:", validWeeks.length);
    console.log("Sample row:", weeklyData[5]);

    validWeeks.sort((a, b) => new Date(a.WeekStart) - new Date(b.WeekStart));

    const labels = validWeeks.map(row => row.WeekStart);
    const currentData = validWeeks.map(row => parseFloat(row.GrossRevenue_Week));
    const lyData = validWeeks.map(row => parseFloat(row.Revenue_LY));

    const ctx = document.getElementById("revenueVsLYChart").getContext("2d");

    if (revenueVsLYChart) {
        revenueVsLYChart.destroy();
    }

    revenueVsLYChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "This Year",
                    data: currentData,
                    borderColor: "#2D5F2E",
                    backgroundColor: "rgba(45, 95, 46, 0.2)",
                    borderWidth: 2,
                    pointBackgroundColor: "#2D5F2E",
                    pointRadius: 4,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: "Last Year",
                    data: lyData,
                    borderColor: "#5B2D8E",
                    backgroundColor: "rgba(91, 45, 142, 0.2)",
                    borderWidth: 2,
                    pointBackgroundColor: "#5B2D8E",
                    pointRadius: 4,
                    fill: false,
                    tension: 0.3
                }
            ]    
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: {color: "#222222"}}
            },
            scales: {
                x: { ticks: { color: "#555555"}},
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
            plugins: {
                legend: { labels: {color: "#222222" } }
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
        const [dailyRes, weeklyRes, targetsRes] = await Promise.all([
            fetch(DAILY_OPS_URL),
            fetch(WEEKLY_FACT_URL),
            fetch(TARGETS_URL)
        ]);

        const dailyText = await dailyRes.text();
        const weeklyText = await weeklyRes.text();
        const targetsText = await targetsRes.text();

        const dailyData = parseCSV(dailyText);
        const weeklyData = parseCSV(weeklyText);
        const targetsData = parseCSV(targetsText);

        const currentWeek = getMostRecentWeek(weeklyData);
        const weekRevenue = parseFloat(currentWeek.GrossRevenue_Week) || 0;
        const currentTarget = getCurrentMonthTarget(targetsData, currentWeek.WeekStart);

        console.log("Daily Data:", dailyData[0]);
        console.log("Weekly Data:", weeklyData[0]);
        console.log("All weeks:", weeklyData.map(row => row.WeekStart));
        console.log("Current Week:", currentWeek);
        console.log("Targets Data:", targetsData[0]);
        console.log("Current Target:", currentTarget);

        // Calculate month to date revenue from daily data
        const today = new Date();
        const weekStart = new Date(currentWeek.WeekStart);
        const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
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
        const monthStart2 = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
        const monthEnd2 = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
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
        renderWeeklyRevenueChart(weeklyData);
        renderMonthlyRevenueChart(dailyData);
        renderRevenueVsLYChart(weeklyData);
        renderMonthlyTargetChart(dailyData, targetsData);
        
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Run on page load
fetchData();

// Auto refresh every 60 seconds
setInterval(fetchData, 60000);

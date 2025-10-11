let correctForecastData = null;
let rawApiResponseData = null;

// Predefined list of cities with coordinates. NWS API uses lat/lon.
const cities = [
    { name: 'Dexter, ME', zip: '04930', lat: '45.02', lon: '-69.29' },
    { name: 'Moorestown, NJ', zip: '08057', lat: '39.96', lon: '-74.94' },
    { name: 'Weston, CT', zip: '06883', lat: '41.20', lon: '-73.38' },
    { name: 'Wimauma, FL', zip: '33598', lat: '27.71', lon: '-82.30' }
];

const defaultCity = cities[3]; // Wimauma, FL

function showMessage(title, content) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-content').textContent = content;
    document.getElementById('message-box').classList.remove('hidden');
}

function hideMessage() {
    document.getElementById('message-box').classList.add('hidden');
}

/**
 * Parses an ISO 8601 timestamp string and returns the hour in that timestamp's specific timezone.
 * This avoids issues where the user's browser timezone differs from the forecast location's timezone.
 * Example: "2024-01-01T08:30:00-05:00" will correctly return 8.
 * @param {string} isoString - The ISO 8601 timestamp.
 * @returns {number} The hour (0-23) from the timestamp.
 */
function getLocalHourFromISO(isoString) {
    return parseInt(isoString.substring(11, 13), 10);
}

function calculateRainfallValue(hourlyData, startHour, endHour) {
    let totalRain = 0;
    for (const hour of hourlyData) {
        const localHour = getLocalHourFromISO(hour.time);
        if (localHour >= startHour && localHour <= endHour) {
            totalRain += (hour.precip_in || 0);
        }
    }
    return totalRain;
}

function getPeriodChanceOfRain(hourlyData, startHour, endHour) {
    let maxChance = 0;
    const relevantHours = hourlyData.filter(h => {
        const localHour = getLocalHourFromISO(h.time);
        return localHour >= startHour && localHour <= endHour;
    });
    for (const hour of relevantHours) {
        if (hour.chance_of_rain > maxChance) {
            maxChance = hour.chance_of_rain;
        }
    }
    return maxChance;
}

function renderDetailsTables() {
    const container = document.getElementById('details-table-container');
    container.innerHTML = ''; 
    
    if (!correctForecastData || correctForecastData.length === 0) return;

    const allDaysHtml = correctForecastData.map((day, index) => {
        const dayOfWeek = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

        return `
            <div class="mb-8 details-table-day hidden" data-day-index="${index}" data-has-precip="${day.hasPrecipitationData}">
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-4">
                    <h3 class="text-xl font-bold text-gray-800 mb-1 sm:mb-0">${dayOfWeek}</h3>
                    <p class="text-sm text-gray-600">Sunrise: <span class="font-medium">${day.astro.sunrise}</span> | Sunset: <span class="font-medium">${day.astro.sunset}</span></p>
                </div>
                <div class="mb-8">
                    <canvas id="chart-day-${index}"></canvas>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left bg-white rounded-xl shadow-md">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="py-3 px-2 sm:px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center sm:text-left rounded-tl-xl">Time</th> 
                                <th class="py-3 px-2 sm:px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Condition</th>
                                <th class="py-3 px-2 sm:px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center">Rain (%)</th>
                                <th class="py-3 px-2 sm:px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center rounded-tr-xl precip-amount-header">Rain (in)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${day.hour.map(hour => `
                                <tr class="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                                    <td class="py-3 px-2 sm:px-4 font-medium text-gray-900 text-sm text-center sm:text-left">${new Date(hour.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                                    <td class="py-3 px-2 sm:px-4 text-gray-700 text-sm">${hour.condition.text}</td> 
                                    <td class="py-3 px-2 sm:px-4 text-gray-700 text-sm text-center">${hour.chance_of_rain ?? 0}</td> 
                                    <td class="py-3 px-2 sm:px-4 text-gray-700 text-sm text-center precip-amount-cell">${hour.precip_in.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = allDaysHtml;

    // Now that the canvases are in the DOM, render the charts
    correctForecastData.forEach((day, index) => {
        const ctx = document.getElementById(`chart-day-${index}`).getContext('2d');
        const labels = day.hour.map(hour => new Date(hour.time).toLocaleTimeString('en-US', { hour: 'numeric' }));
        
        const rawPrecipData = day.hour.map(hour => hour.precip_in); // This will be mostly 0 now
        const cappedPrecipData = rawPrecipData.map(p => Math.min(p, 0.5));

        const backgroundColors = rawPrecipData.map(p => {
            if (p >= 1.0) return 'rgba(190, 24, 93, 0.7)';    // Fuchsia-700 for extreme rain
            if (p > 0.3) return 'rgba(239, 68, 68, 0.6)';     // Red-500 for heavy rain
            if (p > 0.1) return 'rgba(245, 158, 11, 0.6)';    // Orange-500 for moderate rain
            return 'rgba(59, 130, 246, 0.6)';                // Blue-500 for light rain
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Hourly Precipitation (in)',
                    data: cappedPrecipData,
                    backgroundColor: backgroundColors,
                    borderWidth: 0
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: false // Hide the legend as the colors are self-explanatory
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 0.5, // Fix the y-axis from 0 to 0.5 inch
                        title: {
                            display: true,
                            text: 'Precipitation (in)'
                        }
                    },
                    x: {
                        grid: { display: false } // Hide vertical grid lines for a cleaner look
                    }
                }
            }
        });
    });
}

function handleCardClick(event) {
    const card = event.currentTarget;
    const dayIndex = card.dataset.dayIndex;
    const detailsContainer = document.getElementById('details-table-container');
    const jsonContainer = document.getElementById('raw-json-container');
    const jsonOutput = document.getElementById('raw-json-output');

    const isAlreadySelected = card.classList.contains('selected-card');

    // First, deselect all cards and hide all details
    document.querySelectorAll('.weather-card').forEach(c => c.classList.remove('selected-card'));
    document.querySelectorAll('.weather-card').forEach(c => c.setAttribute('aria-expanded', 'false'));
    detailsContainer.classList.add('hidden');
    jsonContainer.classList.add('hidden'); // Hide the entire JSON section by default

    document.querySelectorAll('.details-table-day').forEach(table => table.classList.add('hidden'));
    // If the clicked card was NOT already selected, then we show its details.
    if (!isAlreadySelected) {
        // Select the new card
        card.classList.add('selected-card');
        card.setAttribute('aria-expanded', 'true');

        // Show the correct day's details table
        document.querySelector(`.details-table-day[data-day-index="${dayIndex}"]`).classList.remove('hidden');
        detailsContainer.classList.remove('hidden');

        // Populate and show the raw JSON output
        if (rawApiResponseData) {
            jsonOutput.textContent = JSON.stringify(rawApiResponseData, null, 2);
            jsonOutput.classList.remove('hidden');
            jsonContainer.classList.remove('hidden'); // Show the section with the "Show" button
            document.getElementById('toggle-json-btn').textContent = 'Hide';
        }

        // On smaller and medium (tablet) screens, scroll down to the details section to provide feedback
        if (window.innerWidth < 1280) { // 1280px is the 'xl' breakpoint in Tailwind, covering tablets.
            const headerOffset = 80; // Provides space for a site header or just some breathing room
            const elementPosition = detailsContainer.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset;
          
            window.scrollTo({
                 top: offsetPosition,
                 behavior: "smooth"
            });
        }
    }
}

function showLoadingState() {
    const weatherCardsContainer = document.getElementById('weather-cards');
    weatherCardsContainer.innerHTML = `<div id="loading-spinner" class="col-span-1 md:col-span-3 text-center p-8"><div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status"><span class="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span></div><p class="mt-4 text-gray-500">Loading weather data...</p></div>`;

    // Hide current weather and details sections
    document.getElementById('weather-alerts').classList.add('hidden');
    document.getElementById('current-weather').classList.add('hidden');
    const detailsContainer = document.getElementById('details-table-container');
    detailsContainer.innerHTML = '';
    detailsContainer.classList.add('hidden');
    document.getElementById('raw-json-container').classList.add('hidden');
}

function hideLoadingState() {
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) loadingSpinner.remove();
}

function renderAlerts(alerts) {
    const alertsSection = document.getElementById('weather-alerts');
    const alertsContent = document.getElementById('alerts-content');
    const toggleBtn = document.getElementById('toggle-alerts-btn');

    alertsContent.innerHTML = ''; // Clear old alerts
    alertsSection.classList.add('hidden');

    if (!alerts || alerts.length === 0) {
        return;
    }

    const alertsHtml = alerts.map(alert => {
        let alertClasses = 'bg-gray-100 border-gray-500 text-gray-800'; // Default/Info
        const eventText = alert.event.toLowerCase();

        if (eventText.includes('warning')) {
            alertClasses = 'bg-red-100 border-red-500 text-red-800'; // High severity
        } else if (eventText.includes('watch')) {
            alertClasses = 'bg-orange-100 border-orange-500 text-orange-800'; // Medium severity
        } else if (eventText.includes('advisory')) {
            alertClasses = 'bg-yellow-100 border-yellow-500 text-yellow-800'; // Low severity
        }

        return `
        <div class="p-4 border-l-4 rounded-r-lg shadow-md ${alertClasses}">
            <p class="font-bold">${alert.headline}</p>
            <div class="text-sm mt-2" style="white-space: pre-wrap;">${alert.description}</div>
        </div>
    `
    }).join('');

    alertsContent.innerHTML = alertsHtml;
    alertsSection.classList.remove('hidden');

    // Ensure content is visible and button text is correct when new alerts are loaded
    alertsContent.classList.remove('hidden');
    toggleBtn.textContent = 'Hide';
}

function renderCurrentWeather(currentData) {
    const currentWeatherSection = document.getElementById('current-weather');
    document.getElementById('current-temp').textContent = Math.round(currentData.temperature);
    document.getElementById('current-condition-text').textContent = currentData.shortForecast;
    document.getElementById('current-condition-icon').src = currentData.icon;
    document.getElementById('current-condition-icon').alt = currentData.shortForecast;
    document.getElementById('current-feels-like').textContent = `${Math.round(currentData.windChill?.value ?? currentData.temperature)}°F`;
    document.getElementById('current-wind').textContent = `${currentData.windSpeed} ${currentData.windDirection}`;
    document.getElementById('current-gusts').textContent = `-- mph`; // NWS hourly doesn't provide gusts easily
    document.getElementById('current-humidity').textContent = `${Math.round(currentData.relativeHumidity.value)}%`;
    document.getElementById('current-uv').textContent = '--'; // NWS doesn't provide UV index
    document.getElementById('current-visibility').textContent = `-- mi`; // NWS doesn't provide visibility

    // Format and display the "last updated" timestamp
    const lastUpdatedDate = new Date(currentData.last_updated);
    const formattedTime = lastUpdatedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    document.getElementById('last-updated').textContent = `Last updated at ${formattedTime}`;

    currentWeatherSection.classList.remove('hidden');
}

function renderForecastCards(forecastData, days) {
    const weatherCardsContainer = document.getElementById('weather-cards');
    weatherCardsContainer.innerHTML = ''; // Clear loading spinner or old cards

    if (forecastData.length < days) {
        showMessage('Data Issue', 'Could not retrieve a full three-day forecast. Displaying available data.');
    } else {
        hideMessage();
    }

    const colors = ['from-red-200 to-orange-300', 'from-teal-200 to-cyan-300', 'from-purple-200 to-indigo-300'];

    forecastData.forEach((day, i) => {
        const date = new Date(day.date + 'T00:00:00');
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        const fallbackCondition = { condition: { icon: '', text: 'No data' } };

        const morningRainValue = calculateRainfallValue(day.hour, 6, 11);
        const afternoonRainValue = calculateRainfallValue(day.hour, 12, 17);
        const eveningRainValue = calculateRainfallValue(day.hour, 18, 23);
        const totalDailyRain = morningRainValue + afternoonRainValue + eveningRainValue;

        // Find a representative hour for each period. Fallback to the first available hour of the day if the target hour is in the past.
        const findHour = (targetHour) => day.hour.find(h => getLocalHourFromISO(h.time) === targetHour);

        const morningData = findHour(10) ?? (i === 0 ? day.hour[0] : null) ?? fallbackCondition;
        const morningRain = morningRainValue > 0 ? `${morningRainValue.toFixed(2)} in` : '';
        const morningChance = getPeriodChanceOfRain(day.hour, 6, 11);

        // For afternoon, if 3 PM is not available, try 1 PM.
        const afternoonData = findHour(15) ?? findHour(13) ?? (i === 0 ? day.hour.find(h => getLocalHourFromISO(h.time) >= 12) : null) ?? fallbackCondition;
        const afternoonRain = afternoonRainValue > 0 ? `${afternoonRainValue.toFixed(2)} in` : '';
        const afternoonChance = getPeriodChanceOfRain(day.hour, 12, 17);

        const eveningData = findHour(20) ?? findHour(18) ?? (i === 0 ? day.hour.find(h => getLocalHourFromISO(h.time) >= 17) : null) ?? fallbackCondition;
        const eveningRain = eveningRainValue > 0 ? `${eveningRainValue.toFixed(2)} in` : '';
        const eveningChance = getPeriodChanceOfRain(day.hour, 18, 23);

        const cardHtml = `
            <div class="relative p-6 rounded-3xl text-gray-900 shadow-xl hover:shadow-2xl cursor-pointer transition-all flex flex-col space-y-4 bg-gradient-to-br ${colors[i]} weather-card" data-day-index="${i}" role="button" tabindex="0" aria-expanded="false">
                <div class="flex flex-col items-start">
                    <h2 class="text-3xl font-bold">${dayOfWeek}</h2>
                    <div class="flex items-baseline space-x-2 flex-wrap">
                        <span class="text-xl font-bold">${Math.round(day.day.minTemp)}° / ${Math.round(day.day.maxTemp)}°</span>
                        <span class="text-sm font-medium text-gray-800/80">💧 ${day.day.daily_chance_of_rain}%</span>
                        ${day.hasPrecipitationData && totalDailyRain > 0 ? `<span class="text-sm font-medium text-gray-800/80">${totalDailyRain.toFixed(2)} in</span>` : ''}
                    </div>
                </div>
                
                <div class="mt-4 space-y-2">
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Morning</span>
                        <img src="${morningData.condition.icon ? morningData.condition.icon : ''}" alt="${morningData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${morningData.condition.text} ${morningRain ? `<span class="text-gray-800/60">💧&nbsp;${morningChance}% ${morningRain}</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Afternoon</span>
                        <img src="${afternoonData.condition.icon ? afternoonData.condition.icon : ''}" alt="${afternoonData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${afternoonData.condition.text} ${afternoonRain ? `<span class="text-gray-800/60">💧&nbsp;${afternoonChance}% ${afternoonRain}</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Evening</span>
                        <img src="${eveningData.condition.icon ? eveningData.condition.icon : ''}" alt="${eveningData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${eveningData.condition.text} ${eveningRain ? `<span class="text-gray-800/60">💧&nbsp;${eveningChance}% ${eveningRain}</span>` : ''}</span>
                    </div>
                </div>
            </div>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml.trim();
        const cardElement = tempDiv.firstChild;

        cardElement.addEventListener('click', handleCardClick);
        weatherCardsContainer.appendChild(cardElement);
    });
}

function processNwsData(gridpointData, hourlyData, days) {
    const forecastByDate = {};
    
    // ===================================================================================
    // START: REWRITTEN LOGIC
    // ===================================================================================

    console.log("--- STARTING PRECIPITATION PROCESSING ---");

    // Step 1: Parse the 6-hour precipitation blocks from gridData.
    // CRITICAL FIX: Convert all timestamps to UTC milliseconds for reliable comparison,
    // which avoids all timezone-related bugs.
    const precipPeriods = [];
    const qpfData = gridpointData.properties.quantitativePrecipitation?.values || [];
    for (const period of qpfData) {
        const [startIso, durationStr] = period.validTime.split('/');
        if (!startIso || !durationStr) continue; // Skip malformed periods
        const durationHours = parseInt(durationStr.match(/(\d+)/)[0]);
        const startTimeMs = new Date(startIso).getTime();
        const endTimeMs = startTimeMs + durationHours * 60 * 60 * 1000;
        // Distribute the 6-hour total evenly across the hours and convert from mm to inches.
        const hourlyPrecipAmount = (period.value / 25.4) / durationHours;
        precipPeriods.push({ startTimeMs, endTimeMs, hourlyPrecipAmount });
    }
    console.log(`[1] Parsed ${precipPeriods.length} precipitation periods from the API.`, precipPeriods);

    const hasPrecipitationData = precipPeriods.length > 0 && precipPeriods.some(p => p.hourlyPrecipAmount > 0);

    // Step 2: Iterate through the hourly forecast data and build the daily structure.
    console.log(`[2] Processing ${hourlyData.properties.periods.length} hourly forecast periods.`);
    hourlyData.properties.periods.forEach((hour, index) => {
        const hourDateObj = new Date(hour.startTime);
        const hourTimeMs = hourDateObj.getTime();
        const date = hourDateObj.toISOString().split('T')[0]; // Use UTC date for grouping
        let isFirstHourLog = false;

        if (!forecastByDate[date]) {
            forecastByDate[date] = {
                date: date,
                day: { daily_chance_of_rain: 0, maxTemp: -Infinity, minTemp: Infinity },
                astro: { sunrise: 'N/A', sunset: 'N/A' },
                hour: [],
                hasPrecipitationData: hasPrecipitationData
            };
            isFirstHourLog = true;
        }

        // Step 3: For each hour, find its corresponding 6-hour precipitation block.
        let precip_in = 0;
        const relevantPeriod = precipPeriods.find(p => hourTimeMs >= p.startTimeMs && hourTimeMs < p.endTimeMs);
        if (relevantPeriod) {
            if (isFirstHourLog) { // Log details only for the first hour of a new day to avoid spamming the console
                console.log(`[3] MATCH FOUND for hour ${hour.startTime} (Timestamp: ${hourTimeMs})`);
                console.log(`    - Matched against precip period: Start ${relevantPeriod.startTimeMs}, End ${relevantPeriod.endTimeMs}`);
                console.log(`    - Assigning hourly precip value: ${relevantPeriod.hourlyPrecipAmount.toFixed(4)} inches.`);
            }
            precip_in = relevantPeriod.hourlyPrecipAmount;
        } else if (isFirstHourLog && precipPeriods.length > 0) {
            console.log(`[3] NO MATCH for hour ${hour.startTime} (Timestamp: ${hourTimeMs}). This may be expected if it's outside a rain period.`);
        }

        forecastByDate[date].hour.push({
            time: hour.startTime,
            condition: { text: hour.shortForecast, icon: hour.icon.replace(/size=small/g, 'size=medium') },
            chance_of_rain: hour.probabilityOfPrecipitation.value ?? 0,
            precip_in: precip_in,
            temperature: hour.temperature
        });
    });

    // Step 4: Now that all hours are grouped by day, calculate daily summaries.
    const sortedForecast = Object.values(forecastByDate).sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log("[4] Final grouped and sorted forecast data:", sortedForecast);

    // ===================================================================================
    // START: DEBUGGING CHECK
    // ===================================================================================
    const totalPrecip = sortedForecast.reduce((sum, day) => sum + day.hour.reduce((daySum, h) => daySum + h.precip_in, 0), 0);
    if (totalPrecip === 0 && hasPrecipitationData) {
        console.warn("DEBUG: Rainfall calculation resulted in all zeros, but precipitation data was found. Logging diagnostic info.");
        console.log("  - Raw Precipitation Data (qpfData):", JSON.parse(JSON.stringify(qpfData)));
        console.log("  - Processed Precipitation Periods (precipPeriods with ms timestamps):", JSON.parse(JSON.stringify(precipPeriods)));
        console.log("  - First 5 Hourly Forecast Periods (hourlyData):", JSON.parse(JSON.stringify(hourlyData.properties.periods.slice(0, 5))));
    }
    console.log(`--- FINISHED PRECIPITATION PROCESSING --- Total calculated precip: ${totalPrecip.toFixed(4)} inches.`);

    // ===================================================================================
    // END: DEBUGGING CHECK
    // ===================================================================================

    sortedForecast.forEach(dayData => {
        let maxTemp = -Infinity, minTemp = Infinity, maxChance = 0;
        dayData.hour.forEach(h => {
            if (h.temperature > maxTemp) maxTemp = h.temperature;
            if (h.temperature < minTemp) minTemp = h.temperature;
            if (h.chance_of_rain > maxChance) maxChance = h.chance_of_rain;
        });
        dayData.day.maxTemp = maxTemp;
        dayData.day.minTemp = minTemp;
        dayData.day.daily_chance_of_rain = maxChance;
    });

    // ===================================================================================
    // END: REWRITTEN LOGIC
    // ===================================================================================

    return sortedForecast.slice(0, days);
}

async function fetchAndProcessWeather(city, days) {
    if (!city || !city.lat || !city.lon) {
        console.error("Invalid city object provided:", city);
        showMessage('Error', 'Invalid location data. Cannot fetch weather.');
        return;
    }

    showLoadingState();

    try {
        // Step 1: Get the gridpoints from lat/lon
        const pointsUrl = `https://api.weather.gov/points/${city.lat},${city.lon}`;
        const pointsResponse = await fetch(pointsUrl);
        if (!pointsResponse.ok) throw new Error(`NWS points lookup failed: ${pointsResponse.status}`);
        const pointsData = await pointsResponse.json();

        const gridForecastUrl = pointsData.properties.forecast;
        const hourlyForecastUrl = pointsData.properties.forecastHourly;
        const gridpointDataUrl = pointsData.properties.forecastGridData; // Correct endpoint for precipitation
        const alertsUrl = `https://api.weather.gov/alerts/active?point=${city.lat},${city.lon}`;

        // Step 2: Fetch grid, hourly, and alerts data in parallel
        const [gridResponse, hourlyResponse, gridpointResponse, alertsResponse] = await Promise.all([
            fetch(gridForecastUrl),
            fetch(hourlyForecastUrl),
            fetch(gridpointDataUrl),
            fetch(alertsUrl)
        ]);

        if (!gridResponse.ok) throw new Error(`NWS grid forecast fetch failed: ${gridResponse.status}`);
        if (!hourlyResponse.ok) throw new Error(`NWS hourly forecast fetch failed: ${hourlyResponse.status}`);
        if (!gridpointResponse.ok) throw new Error(`NWS gridpoint data fetch failed: ${gridpointResponse.status}`);
        if (!alertsResponse.ok) throw new Error(`NWS alerts fetch failed: ${alertsResponse.status}`);

        const gridData = await gridResponse.json();
        const hourlyData = await hourlyResponse.json();
        const gridpointData = await gridpointResponse.json();
        const alertsData = await alertsResponse.json();

        rawApiResponseData = { grid: gridData, hourly: hourlyData, alerts: alertsData }; // Store for debugging
        correctForecastData = []; // Reset data

        document.getElementById('location-name').textContent = city.name.split(',')[0];

        correctForecastData = processNwsData(gridpointData, hourlyData, days);
        const currentConditions = hourlyData.properties.periods[0];
        currentConditions.last_updated = hourlyData.properties.updateTime;

        renderAlerts(alertsData.features.map(f => f.properties));
        renderCurrentWeather(currentConditions);
        renderForecastCards(correctForecastData, days);
        renderDetailsTables();

    } catch (error) {
        console.error("Could not fetch weather data:", error);
        showMessage('Error', 'Failed to fetch weather data. Please check your connection or API key.');
    } finally {
        hideLoadingState();
    }
}

function handleLocationClick() {
    const modal = document.getElementById('city-selection-modal');
    const cityList = document.getElementById('city-list');

    // Clear any existing list items
    cityList.innerHTML = '';

    // Populate the list with cities
    cities.forEach(city => {
        const li = document.createElement('li');
        li.textContent = city.name.replace(',', ', ');
        li.dataset.zip = city.zip;
        li.className = 'p-2 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors';
        li.addEventListener('click', handleCitySelection);
        cityList.appendChild(li);
    });

    modal.classList.remove('hidden');
}

function handleCitySelection(event) {
    const zip = event.target.dataset.zip;
    if (zip) {
        const selectedCity = cities.find(c => c.zip === zip);
        if (!selectedCity) return;

        // Immediately update the header to reflect the user's choice
        document.getElementById('location-name').textContent = selectedCity.name.split(',')[0];

        // Update the URL without reloading the page, for bookmarking
        const newUrl = `${window.location.pathname}?location=${zip}`;
        window.history.pushState({ path: newUrl }, '', newUrl);

        fetchAndProcessWeather(selectedCity, 3);

        // Hide the modal
        document.getElementById('city-selection-modal').classList.add('hidden');
    }
}
// Initial fetch when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const closeButton = document.querySelector('#message-box button');
    if (closeButton) {
        closeButton.addEventListener('click', hideMessage);
    }

    const toggleJsonBtn = document.getElementById('toggle-json-btn');
    const jsonOutput = document.getElementById('raw-json-output');
    toggleJsonBtn.addEventListener('click', () => {
        const isHidden = jsonOutput.classList.toggle('hidden');
        toggleJsonBtn.textContent = isHidden ? 'Show' : 'Hide';
    });

    const initialCity = cities.find(c => c.zip === new URLSearchParams(window.location.search).get('location')) || defaultCity;
    document.getElementById('location-name').textContent = initialCity.name.split(',')[0];
    document.getElementById('location-name').addEventListener('click', handleLocationClick);
    document.getElementById('close-city-modal-btn').addEventListener('click', () => document.getElementById('city-selection-modal').classList.add('hidden'));
    document.getElementById('alerts-header')?.addEventListener('click', () => {
        const isHidden = document.getElementById('alerts-content').classList.toggle('hidden');
        document.getElementById('toggle-alerts-btn').textContent = isHidden ? 'Show' : 'Hide';
    });

    fetchAndProcessWeather(initialCity, 3);
});
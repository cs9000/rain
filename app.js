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

/**
 * Maps NWS forecast text to a corresponding Weather Icons class.
 * @param {string} forecast - The short forecast string from the NWS API.
 * @param {boolean} isDay - True if it's daytime, false for night.
 * @returns {string} The appropriate Weather Icons class name (e.g., 'wi wi-day-sunny').
 */
function getWeatherIconClass(forecast, isDay) {
    if (!forecast) return 'wi wi-na'; // Return 'not available' icon if no forecast

    const f = forecast.toLowerCase();
    const time = isDay ? 'day' : 'night';

    // Thunderstorms
    if (f.includes('thunderstorm')) {
        if (f.includes('showers')) return `wi wi-${time}-storm-showers`;
        return `wi wi-${time}-thunderstorm`;
    }
    // Rain/Drizzle/Showers
    if (f.includes('showers')) return `wi wi-${time}-showers`;
    if (f.includes('rain') || f.includes('drizzle')) return `wi wi-${time}-rain`;

    // Snow/Sleet
    if (f.includes('snow')) return `wi wi-${time}-snow`;
    if (f.includes('sleet')) return `wi wi-${time}-sleet`;

    // Fog/Haze/Smoke
    if (f.includes('fog')) return `wi wi-${time}-fog`;
    if (f.includes('haze') || f.includes('smoke')) return 'wi wi-smoke';

    // Cloudy
    if (f.includes('mostly cloudy')) return `wi wi-${time}-cloudy`;
    if (f.includes('partly cloudy') || f.includes('partly sunny')) return `wi wi-${time}-cloudy`;
    if (f.includes('cloudy')) return 'wi wi-cloudy';

    // Sunny/Clear
    if (f.includes('mostly sunny')) return `wi wi-${time}-sunny`;
    if (f.includes('sunny')) return `wi wi-${time}-sunny`;
    if (f.includes('clear')) return `wi wi-${time}-clear`;

    // Wind
    if (f.includes('windy') || f.includes('breezy')) return `wi wi-${time}-windy`;

    // Default fallback
    return `wi wi-${time}-cloudy`;
}

/**
 * Converts a degree value to a 16-point cardinal direction string.
 * @param {number} deg - The degree value (0-360).
 * @returns {string} The cardinal direction (e.g., 'N', 'NNE', 'SW').
 */
function degreesToCardinal(deg) {
    if (deg === null || deg === undefined) return '';
    // Ensure degrees are within the 0-359 range
    const degree = (deg + 360) % 360;
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    // Each of the 16 directions covers a 22.5 degree slice (360 / 16 = 22.5)
    const index = Math.round(degree / 22.5) % 16;
    return dirs[index];
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
        const cappedPrecipData = rawPrecipData.map(p => Math.min(p, 0.25));

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
                        max: 0.25, // Fix the y-axis from 0 to 0.25 inch
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

function renderCurrentWeather(latestObservation, hourlyPeriod, gridpointData) {
    const currentWeatherSection = document.getElementById('current-weather');

    // Use the latest observation for the most accurate "now" data.
    // The API provides values in metric, so we convert them.
    const tempF = latestObservation.temperature.value * 9/5 + 32;
    const dewpointF = latestObservation.dewpoint.value * 9/5 + 32;
    const windSpeedMph = latestObservation.windSpeed.value * 0.621371;
    const windGustMph = latestObservation.windGust.value ? latestObservation.windGust.value * 0.621371 : 0;

    document.getElementById('current-temp').textContent = Math.round(tempF);
    document.getElementById('current-condition-text').textContent = latestObservation.textDescription;
    // Use the hourly forecast's isDaytime property to get the right icon (day/night)
    const iconClass = getWeatherIconClass(latestObservation.textDescription, hourlyPeriod.isDaytime);
    document.getElementById('current-condition-icon').className = `text-6xl text-gray-700 ${iconClass}`;

    // Format and display the "last updated" timestamp from the observation station.
    const lastUpdatedDate = new Date(latestObservation.timestamp);
    const formattedTime = lastUpdatedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    document.getElementById('last-updated').textContent = `Updated from station at ${formattedTime}`;

    // Find the current hour's data from the more detailed gridpointData for humidity and dewpoint
    // CRITICAL: Convert the start time to a UTC-based timestamp by parsing it and then getting the UTC time.
    // This avoids timezone mismatches with the gridpoint data, which is in UTC.
    const currentHourStartMs = new Date(hourlyPeriod.startTime).getTime(); 

    // This robustly finds the corresponding value from the gridpoint data arrays (like dewpoint, humidity).
    // It correctly handles the UTC-based time intervals from the gridpoint endpoint.
    const findCurrentGridValue = (values) => {
        if (!values) return null;
        const period = values.find(p => {
            // The gridpoint data provides time intervals in ISO 8601 format, e.g., "2024-07-25T18:00:00+00:00/PT1H"
            const [startIso, durationStr] = p.validTime.split('/');
            if (!startIso || !durationStr) return false;

            const periodStartMs = new Date(startIso).getTime();
            const durationMatch = durationStr.match(/(\d+)/);
            if (!durationMatch) return false; // Handle cases where duration might be malformed
            const durationHours = parseInt(durationMatch[0]);
            const periodEndMs = periodStartMs + (durationHours * 60 * 60 * 1000);
            return currentHourStartMs >= periodStartMs && currentHourStartMs < periodEndMs;
        });
        return period?.value;
    };

    // Use observation data for primary fields, fall back to forecast for others.
    const windDirectionCardinal = degreesToCardinal(latestObservation.windDirection.value);
    document.getElementById('current-feels-like').textContent = `${Math.round(latestObservation.heatIndex.value ? latestObservation.heatIndex.value * 9/5 + 32 : tempF)}°F`;
    document.getElementById('current-wind').textContent = `${Math.round(windSpeedMph)} mph ${windDirectionCardinal}`;
    
    // Humidity: Prioritize live observation, but fall back to the hourly forecast grid data if not available.
    if (latestObservation.relativeHumidity.value) {
        document.getElementById('current-humidity').textContent = `${Math.round(latestObservation.relativeHumidity.value)}%`;
    } else {
        const humidityValue = findCurrentGridValue(gridpointData.properties.relativeHumidity?.values);
        document.getElementById('current-humidity').textContent = humidityValue ? `${Math.round(humidityValue)}%` : 'N/A';
    }
    document.getElementById('current-dew-point').textContent = `${Math.round(dewpointF)}°F`;
    
    // Chance of Rain is not in observations, so we get it from the hourly forecast period.
    document.getElementById('current-chance-of-rain').textContent = `${hourlyPeriod.probabilityOfPrecipitation.value ?? 0}%`;

    // Wind Gusts: Prioritize live observation, but fall back to the hourly forecast grid data if not available.
    if (windGustMph > 0) {
        const gustMph = Math.round(windGustMph);
        document.getElementById('current-gusts').textContent = `${gustMph} mph`;
    } else {
        const currentGustPeriodValue = findCurrentGridValue(gridpointData.properties.windGust?.values);
        if (currentGustPeriodValue && currentGustPeriodValue > 0) {
            const gustMph = Math.round(currentGustPeriodValue * 0.621371); // Convert from km/h
            document.getElementById('current-gusts').textContent = `${gustMph} mph`;
        } else {
            document.getElementById('current-gusts').textContent = 'N/A';
        }
    }
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
                        <i class="${getWeatherIconClass(morningData.condition.text, true)} text-2xl text-center"></i>
                        <span class="text-base font-medium md:text-sm md:font-normal">${morningData.condition.text} ${morningRain ? `<span class="block sm:inline text-gray-800/60 whitespace-nowrap">💧&nbsp;${morningChance}% ${morningRain}</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Afternoon</span>
                        <i class="${getWeatherIconClass(afternoonData.condition.text, true)} text-2xl text-center"></i>
                        <span class="text-base font-medium md:text-sm md:font-normal">${afternoonData.condition.text} ${afternoonRain ? `<span class="block sm:inline text-gray-800/60 whitespace-nowrap">💧&nbsp;${afternoonChance}% ${afternoonRain}</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Evening</span>
                        <i class="${getWeatherIconClass(eveningData.condition.text, false)} text-2xl text-center"></i>
                        <span class="text-base font-medium md:text-sm md:font-normal">${eveningData.condition.text} ${eveningRain ? `<span class="block sm:inline text-gray-800/60 whitespace-nowrap">💧&nbsp;${eveningChance}% ${eveningRain}</span>` : ''}</span>
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

function processNwsData(gridData, gridpointData, hourlyData, days, pointsData) {
    const forecastByDate = {};
    
    // ===================================================================================
    // START: Data Processing Logic
    // ===================================================================================

    // Step 2: Parse the 6-hour precipitation blocks from gridData.
    const precipPeriods = [];
    const qpfData = gridpointData.properties.quantitativePrecipitation?.values || [];
    for (const period of qpfData) {
        const [startIso, durationStr] = period.validTime.split('/');
        if (!startIso || !durationStr) continue; // Skip malformed periods
        const durationHours = parseInt((durationStr.match(/(\d+)/) || ['1'])[0]); // Default to 1 to prevent crash
        const startTimeMs = new Date(startIso).getTime();
        const endTimeMs = startTimeMs + durationHours * 60 * 60 * 1000;
        // Distribute the 6-hour total evenly across the hours and convert from mm to inches.
        const hourlyPrecipAmount = (period.value / 25.4) / durationHours;
        precipPeriods.push({ startTimeMs, endTimeMs, hourlyPrecipAmount });
    }

    const hasPrecipitationData = precipPeriods.length > 0 && precipPeriods.some(p => p.hourlyPrecipAmount > 0);

    // Step 3: Iterate through the hourly forecast data and build the daily structure.
    // Use a for...of loop so we can 'break' out of it once we have enough days.
    for (const hour of hourlyData.properties.periods) {
        const hourDateObj = new Date(hour.startTime);
        const hourTimeMs = hourDateObj.getTime();
        // Use the local date from the timestamp, which we will use for display. The astro lookup will use UTC.
        const displayDate = hour.startTime.substring(0, 10);
        // CRITICAL: Define the UTC date key *before* using it for lookups.
        const date = hourDateObj.toISOString().substring(0, 10);

        // Stop processing if we've already collected the required number of days plus one buffer day.
        if (Object.keys(forecastByDate).length > days) break;

        if (!forecastByDate[displayDate]) {
            // DEFINITIVE FIX: Use SunCalc library to calculate astro data based on the date and location's coordinates.
            // This is far more reliable than trying to parse it from the NWS API.
            const lat = parseFloat(pointsData.properties.relativeLocation.geometry.coordinates[1]);
            const lon = parseFloat(pointsData.properties.relativeLocation.geometry.coordinates[0]);
            const sunTimes = SunCalc.getTimes(hourDateObj, lat, lon);
            const sunrise = sunTimes.sunrise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const sunset = sunTimes.sunset.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            forecastByDate[displayDate] = {
                date: displayDate, // Use the local date for card grouping
                day: { daily_chance_of_rain: 0, maxTemp: -Infinity, minTemp: Infinity },
                astro: { sunrise: sunrise, sunset: sunset },
                hour: [],
                hasPrecipitationData: hasPrecipitationData
            };
        }

        // Step 4: For each hour, find its corresponding 6-hour precipitation block.
        let precip_in = 0;
        const relevantPeriod = precipPeriods.find(p => hourTimeMs >= p.startTimeMs && hourTimeMs < p.endTimeMs);
        if (relevantPeriod) precip_in = relevantPeriod.hourlyPrecipAmount;

        forecastByDate[displayDate].hour.push({
            time: hour.startTime,
            condition: { text: hour.shortForecast, icon: hour.icon.replace(/size=small/g, 'size=medium') },
            chance_of_rain: hour.probabilityOfPrecipitation.value ?? 0,
            precip_in: precip_in,
            temperature: hour.temperature
        });
    }

    // Step 5: Now that all hours are grouped by day, calculate daily summaries.
    const sortedForecast = Object.values(forecastByDate).sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const dayData of sortedForecast) {
        let maxTemp = -Infinity, minTemp = Infinity, maxChance = 0;
        dayData.hour.forEach(h => {
            if (h.temperature > maxTemp) maxTemp = h.temperature;
            if (h.temperature < minTemp) minTemp = h.temperature;
            if (h.chance_of_rain > maxChance) maxChance = h.chance_of_rain;
        });
        dayData.day.maxTemp = maxTemp;
        dayData.day.minTemp = minTemp;
        dayData.day.daily_chance_of_rain = maxChance;
    }

    return sortedForecast.slice(0, days);
}

async function fetchAndProcessWeather(city, days, pointsDataCache = null) {
    if (!city || !city.lat || !city.lon) {
        console.error("Invalid city object provided:", city);
        showMessage('Error', 'Invalid location data. Cannot fetch weather.');
        return;
    }

    showLoadingState();

    try {
        // Step 1: Get the gridpoints from lat/lon
        let pointsData = pointsDataCache;
        if (!pointsData) {
            const pointsUrl = `https://api.weather.gov/points/${city.lat},${city.lon}`;
            const pointsResponse = await fetch(pointsUrl, { cache: 'no-cache' });
            if (!pointsResponse.ok) throw new Error(`NWS points lookup failed: ${pointsResponse.status}`);
            pointsData = await pointsResponse.json();
        }

        // The rest of the URLs are derived from the pointsData
        const gridForecastUrl = pointsData.properties.forecast;
        const hourlyForecastUrl = pointsData.properties.forecastHourly;
        const stationsUrl = pointsData.properties.observationStations; // Endpoint to find nearby stations
        const alertsUrl = `https://api.weather.gov/alerts/active?point=${city.lat},${city.lon}`;
        // CRITICAL FIX: The `forecastGridData` URL is for precipitation only. The full gridpoint data,
        // including astronomical info, must be fetched from the base gridpoints URL.
        const { gridId, gridX, gridY } = pointsData.properties;
        const gridpointDataUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}`;

        // Step 2: Fetch grid, hourly, and alerts data in parallel
        const fetchOptions = { cache: 'no-cache' };
        const responses = await Promise.all([
            fetch(gridForecastUrl, fetchOptions),
            fetch(hourlyForecastUrl, fetchOptions),
            fetch(gridpointDataUrl, fetchOptions),
            fetch(alertsUrl, fetchOptions),
            fetch(stationsUrl, fetchOptions) // Fetch the list of stations
        ]);

        const [gridResponse, hourlyResponse, gridpointResponse, alertsResponse, stationsResponse] = responses;

        if (!gridResponse.ok) throw new Error(`NWS grid forecast fetch failed: ${gridResponse.status}`);
        if (!hourlyResponse.ok) throw new Error(`NWS hourly forecast fetch failed: ${hourlyResponse.status}`);
        if (!gridpointResponse.ok) throw new Error(`NWS gridpoint data fetch failed: ${gridpointResponse.status}`);
        if (!alertsResponse.ok) throw new Error(`NWS alerts fetch failed: ${alertsResponse.status}`);
        if (!stationsResponse.ok) throw new Error(`NWS stations lookup failed: ${stationsResponse.status}`);

        const gridData = await gridResponse.json();
        const hourlyData = await hourlyResponse.json();
        const gridpointData = await gridpointResponse.json();
        const alertsData = await alertsResponse.json();
        const stationsData = await stationsResponse.json();

        rawApiResponseData = { grid: gridData, gridpoint: gridpointData, hourly: hourlyData, alerts: alertsData }; // Store for debugging
        correctForecastData = []; // Reset data

        document.getElementById('location-name').textContent = city.name.split(',')[0];

        // Step 3: Get the latest observation from the nearest station
        const closestStationUrl = stationsData.observationStations[0] + "/observations/latest";
        const observationResponse = await fetch(closestStationUrl, fetchOptions);
        if (!observationResponse.ok) throw new Error(`NWS latest observation fetch failed: ${observationResponse.status}`);
        const latestObservationData = await observationResponse.json();

        // Now we have all the data we need.
        correctForecastData = processNwsData(gridData, gridpointData, hourlyData, days, pointsData);
        const firstHourlyPeriod = hourlyData.properties.periods[0];

        renderAlerts(alertsData.features.map(f => f.properties));
        // Pass the fresh observation data AND the first hourly forecast period to the render function
        renderCurrentWeather(latestObservationData.properties, firstHourlyPeriod, gridpointData);
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

        fetchAndProcessWeather(selectedCity, 3, null); // Pass null to force a new points lookup

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
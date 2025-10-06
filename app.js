let correctForecastData = null;
let rawApiResponseData = null;

// Predefined list of cities and their corresponding zip codes
const cities = [
    { name: 'Dexter', zip: '04930' },
    { name: 'Moorestown', zip: '08057' },
    { name: 'Weston', zip: '06883' },
    { name: 'Wimauma', zip: '33598' }
];

function showMessage(title, content) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-content').textContent = content;
    document.getElementById('message-box').classList.remove('hidden');
}

function hideMessage() {
    document.getElementById('message-box').classList.add('hidden');
}

function calculateRainfallValue(hourlyData, startHour, endHour) {
    let totalRain = 0;
    for (let i = startHour; i <= endHour; i++) {
        if (hourlyData[i]) {
            totalRain += hourlyData[i].precip_in;
        }
    }
    return totalRain;
}

function getPeriodChanceOfRain(hourlyData, startHour, endHour) {
    let maxChance = 0;
    for (let i = startHour; i <= endHour; i++) {
        if (hourlyData[i] && hourlyData[i].chance_of_rain > maxChance) {
            maxChance = hourlyData[i].chance_of_rain;
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
            <div class="mb-8 details-table-day hidden" data-day-index="${index}">
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
                                <th class="py-3 px-2 sm:px-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-center rounded-tr-xl">Rain (in)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${day.hour.map(hour => `
                                <tr class="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                                    <td class="py-3 px-2 sm:px-4 font-medium text-gray-900 text-sm text-center sm:text-left">${new Date(hour.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                                    <td class="py-3 px-2 sm:px-4 text-gray-700 text-sm">${hour.condition.text}</td> 
                                    <td class="py-3 px-2 sm:px-4 text-gray-700 text-sm text-center">${hour.chance_of_rain}</td> 
                                    <td class="py-3 px-2 sm:px-4 text-gray-700 text-sm text-center">${hour.precip_in.toFixed(2)}</td>
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
        
        const rawPrecipData = day.hour.map(hour => hour.precip_in);
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

        // Populate the raw JSON output but keep it hidden
        if (rawApiResponseData) {
            jsonOutput.textContent = JSON.stringify(rawApiResponseData, null, 2);
            jsonContainer.classList.remove('hidden'); // Show the section with the "Show" button
        }

        // On smaller and medium (tablet) screens, scroll down to the details section to provide feedback
        if (window.innerWidth < 1024) { // 1024px is the 'lg' breakpoint in Tailwind
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
    const alertsContainer = document.getElementById('weather-alerts');
    alertsContainer.innerHTML = ''; // Clear old alerts
    alertsContainer.classList.add('hidden');

    if (!alerts || alerts.length === 0) {
        return; // No alerts to display
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
            <p class="text-sm mt-2">${alert.desc}</p>
        </div>
    `
    }).join('');

    alertsContainer.innerHTML = alertsHtml;
    alertsContainer.classList.remove('hidden');
}

function renderCurrentWeather(currentData) {
    const currentWeatherSection = document.getElementById('current-weather');
    document.getElementById('current-temp').textContent = Math.round(currentData.temp_f);
    document.getElementById('current-condition-text').textContent = currentData.condition.text;
    document.getElementById('current-condition-icon').src = 'https:' + currentData.condition.icon;
    document.getElementById('current-condition-icon').alt = currentData.condition.text;
    document.getElementById('current-feels-like').textContent = `${Math.round(currentData.feelslike_f)}°F`;
    document.getElementById('current-wind').textContent = `${Math.round(currentData.wind_mph)} mph ${currentData.wind_dir}`;
    document.getElementById('current-gusts').textContent = `${Math.round(currentData.gust_mph)} mph`;
    document.getElementById('current-humidity').textContent = `${currentData.humidity}%`;
    document.getElementById('current-uv').textContent = currentData.uv;
    document.getElementById('current-visibility').textContent = `${currentData.vis_miles} mi`;

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

        const morningData = day.hour[10] ?? fallbackCondition;
        const morningRain = morningRainValue > 0 ? `${morningRainValue.toFixed(2)} in` : '';
        const morningChance = getPeriodChanceOfRain(day.hour, 6, 11);

        const afternoonData = day.hour[15] ?? fallbackCondition;
        const afternoonRain = afternoonRainValue > 0 ? `${afternoonRainValue.toFixed(2)} in` : '';
        const afternoonChance = getPeriodChanceOfRain(day.hour, 12, 17);

        const eveningData = day.hour[20] ?? fallbackCondition;
        const eveningRain = eveningRainValue > 0 ? `${eveningRainValue.toFixed(2)} in` : '';
        const eveningChance = getPeriodChanceOfRain(day.hour, 18, 23);

        const cardHtml = `
            <div class="relative p-6 rounded-3xl text-gray-900 shadow-xl hover:shadow-2xl cursor-pointer transition-all flex flex-col space-y-4 bg-gradient-to-br ${colors[i]} weather-card" data-day-index="${i}" role="button" tabindex="0" aria-expanded="false">
                <div class="flex flex-col items-start">
                    <h2 class="text-3xl font-bold">${dayOfWeek}</h2>
                    <div class="flex items-baseline space-x-2 flex-wrap">
                        <span class="text-xl font-bold">${Math.round(day.day.mintemp_f)}° / ${Math.round(day.day.maxtemp_f)}°</span>
                        <span class="text-sm font-medium text-gray-800/80">💧 ${day.day.daily_chance_of_rain}%</span>
                        ${totalDailyRain > 0 ? `<span class="text-sm font-medium text-gray-800/80">${totalDailyRain.toFixed(2)} in</span>` : ''}
                    </div>
                </div>
                
                <div class="mt-4 space-y-2">
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Morning</span>
                        <img src="${morningData.condition.icon ? 'https:' + morningData.condition.icon : ''}" alt="${morningData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${morningData.condition.text} ${morningRain ? `<span class="text-gray-800/60">💧&nbsp;${morningChance}% ${morningRain}</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Afternoon</span>
                        <img src="${afternoonData.condition.icon ? 'https:' + afternoonData.condition.icon : ''}" alt="${afternoonData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${afternoonData.condition.text} ${afternoonRain ? `<span class="text-gray-800/60">💧&nbsp;${afternoonChance}% ${afternoonRain}</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Evening</span>
                        <img src="${eveningData.condition.icon ? 'https:' + eveningData.condition.icon : ''}" alt="${eveningData.condition.text}" class="w-8 h-8">
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

async function fetchAndProcessWeather(location, days) {
    const apiKey = '7b2406496cd94d9f8ad151853252208';
    // Request one more day than needed to handle late-night scenarios where 'today' might be dropped.
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=${days + 1}&aqi=no&alerts=yes`;

    showLoadingState();

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        rawApiResponseData = data;
        correctForecastData = []; // Reset data

        // Update the location name in the header
        document.getElementById('location-name').textContent = data.location.name;

        // The API response's first forecast day is always "today" for the requested location.
        // We simply slice from the beginning of the array to get the correct number of days.
        correctForecastData = data.forecast.forecastday.slice(0, days);
        
        // Render all the UI components with the new data
        renderAlerts(data.alerts.alert);
        renderCurrentWeather(data.current);
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
        li.textContent = city.name;
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
        // Update the URL without reloading the page, for bookmarking
        const newUrl = `${window.location.pathname}?location=${zip}`;
        window.history.pushState({ path: newUrl }, '', newUrl);

        // Fetch new weather data
        fetchAndProcessWeather(zip, 3);

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
        if (isHidden) {
            toggleJsonBtn.textContent = 'Show';
        } else {
            toggleJsonBtn.textContent = 'Hide';
        }
    });

    // Hide the JSON output by default when the page loads
    jsonOutput.classList.add('hidden');
    toggleJsonBtn.textContent = 'Show';

    // Check for a 'location' URL parameter, otherwise use the default.
    const urlParams = new URLSearchParams(window.location.search);
    const locationParam = urlParams.get('location');
    const defaultLocation = '33598';

    // Add event listener for the location header
    document.getElementById('location-name').addEventListener('click', handleLocationClick);

    // Add event listener for the new modal's close button
    document.getElementById('close-city-modal-btn').addEventListener('click', () => {
        document.getElementById('city-selection-modal').classList.add('hidden');
    });

    fetchAndProcessWeather(locationParam || defaultLocation, 3);
});
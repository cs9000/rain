let correctForecastData = null;
let rawApiResponseData = null;

function showMessage(title, content) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-content').textContent = content;
    document.getElementById('message-box').classList.remove('hidden');
}

function hideMessage() {
    document.getElementById('message-box').classList.add('hidden');
}

function calculateRainfall(hourlyData, startHour, endHour) {
    let totalRain = 0;
    for (let i = startHour; i <= endHour; i++) {
        if (hourlyData[i]) {
            totalRain += hourlyData[i].precip_in;
        }
    }
    return totalRain > 0 ? `${totalRain.toFixed(2)} in` : '';
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
                <div class="flex justify-between items-baseline mb-4">
                    <h3 class="text-xl font-bold text-gray-800">${dayOfWeek}</h3>
                    <p class="text-sm text-gray-600">Sunrise: <span class="font-medium">${day.astro.sunrise}</span> | Sunset: <span class="font-medium">${day.astro.sunset}</span></p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left bg-white rounded-xl shadow-md">
                        <thead class="bg-gray-200">
                            <tr>
                                <th class="py-4 px-6 rounded-tl-xl text-sm font-semibold text-gray-600 uppercase tracking-wider">Time</th> 
                                <th class="py-4 px-6 text-sm font-semibold text-gray-600 uppercase tracking-wider">Condition</th>
                                <th class="py-4 px-6 text-sm font-semibold text-gray-600 uppercase tracking-wider">Temp (°F)</th>
                                <th class="py-4 px-6 text-sm font-semibold text-gray-600 uppercase tracking-wider">Rain (%)</th>
                                <th class="py-4 px-6 rounded-tr-xl text-sm font-semibold text-gray-600 uppercase tracking-wider">Rain (in)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${day.hour.map(hour => `
                                <tr class="border-t border-gray-200 hover:bg-gray-50 transition-colors">
                                    <td class="py-4 px-6 font-medium text-gray-900">${new Date(hour.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                                    <td class="py-4 px-6 text-gray-700">${hour.condition.text}</td> 
                                    <td class="py-4 px-6 text-gray-700">${Math.round(hour.temp_f)}</td> 
                                    <td class="py-4 px-6 text-gray-700">${hour.chance_of_rain}</td> 
                                    <td class="py-4 px-6 text-gray-700">${hour.precip_in.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = allDaysHtml;
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
    }
}

function showLoadingState() {
    const weatherCardsContainer = document.getElementById('weather-cards');
    weatherCardsContainer.innerHTML = `<div id="loading-spinner" class="col-span-1 md:col-span-3 text-center p-8"><div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status"><span class="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span></div><p class="mt-4 text-gray-500">Loading weather data...</p></div>`;

    // Hide current weather and details sections
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
        const morningData = day.hour[10] ?? fallbackCondition;
        const morningRain = calculateRainfall(day.hour, 6, 11);
        const morningChance = getPeriodChanceOfRain(day.hour, 6, 11);

        const afternoonData = day.hour[15] ?? fallbackCondition;
        const afternoonRain = calculateRainfall(day.hour, 12, 17);
        const afternoonChance = getPeriodChanceOfRain(day.hour, 12, 17);

        const eveningData = day.hour[20] ?? fallbackCondition;
        const eveningRain = calculateRainfall(day.hour, 18, 23);
        const eveningChance = getPeriodChanceOfRain(day.hour, 18, 23);

        const cardHtml = `
            <div class="relative p-6 rounded-3xl text-gray-900 shadow-xl hover:shadow-2xl cursor-pointer transition-all flex flex-col space-y-4 bg-gradient-to-br ${colors[i]} weather-card" data-day-index="${i}" role="button" tabindex="0" aria-expanded="false">
                <div class="flex flex-col items-start">
                    <h2 class="text-3xl font-bold">${dayOfWeek}</h2>
                    <div class="flex items-baseline space-x-2">
                        <span class="text-xl font-bold">${Math.round(day.day.mintemp_f)}° / ${Math.round(day.day.maxtemp_f)}°</span>
                        <span class="text-sm font-medium text-gray-800/80">💧 ${day.day.daily_chance_of_rain}%</span>
                    </div>
                </div>
                
                <div class="mt-4 space-y-2">
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Morning</span>
                        <img src="${morningData.condition.icon ? 'https:' + morningData.condition.icon : ''}" alt="${morningData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${morningData.condition.text} ${morningChance > 0 && morningRain ? `<span class="text-gray-800/60">(💧${morningChance}% ${morningRain})</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Afternoon</span>
                        <img src="${afternoonData.condition.icon ? 'https:' + afternoonData.condition.icon : ''}" alt="${afternoonData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${afternoonData.condition.text} ${afternoonChance > 0 && afternoonRain ? `<span class="text-gray-800/60">(💧${afternoonChance}% ${afternoonRain})</span>` : ''}</span>
                    </div>
                    <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                        <span class="text-sm font-bold md:font-normal">Evening</span>
                        <img src="${eveningData.condition.icon ? 'https:' + eveningData.condition.icon : ''}" alt="${eveningData.condition.text}" class="w-8 h-8">
                        <span class="text-base font-medium md:text-sm md:font-normal">${eveningData.condition.text} ${eveningChance > 0 && eveningRain ? `<span class="text-gray-800/60">(💧${eveningChance}% ${eveningRain})</span>` : ''}</span>
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
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=${days + 1}`;

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

        // Find and slice the correct forecast days
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];
        let startIndex = data.forecast.forecastday.findIndex(day => day.date === todayDateString);
        if(startIndex === -1) {
            startIndex = 0; 
        }
        correctForecastData = data.forecast.forecastday.slice(startIndex, startIndex + days);
        
        // Render all the UI components with the new data
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

    fetchAndProcessWeather('33598', 3);
});
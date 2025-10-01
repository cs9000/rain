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
    return totalRain > 0 ? ` (${totalRain.toFixed(1)} in)` : '';
}

function renderDetailsTables() {
    const container = document.getElementById('details-table-container');
    container.innerHTML = ''; 
    
    if (!correctForecastData) return;

    const allDaysHtml = correctForecastData.map((day) => {
        const dayOfWeek = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });

        return `
            <div class="mb-8 details-table-day">
                <h3 class="text-xl font-bold text-gray-800 mb-4">${dayOfWeek}</h3>
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

function toggleDetailsTable() {
    const detailsContainer = document.getElementById('details-table-container');
    const toggleButton = document.getElementById('toggle-details-btn');
    const jsonContainer = document.getElementById('raw-json-container');
    const jsonOutput = document.getElementById('raw-json-output');

    const isHidden = detailsContainer.classList.contains('hidden');

    if (isHidden) {
        // Show details and raw JSON
        if (rawApiResponseData) {
            jsonOutput.textContent = JSON.stringify(rawApiResponseData, null, 2);
            detailsContainer.classList.remove('hidden');
            jsonContainer.classList.remove('hidden');
            toggleButton.textContent = 'Hide Details';
        }
    } else {
        // Hide details and raw JSON
        detailsContainer.classList.add('hidden');
        jsonContainer.classList.add('hidden');
        toggleButton.textContent = 'See Details';
    }
}

async function fetchWeather(location, days) {
    const apiKey = '7b2406496cd94d9f8ad151853252208';
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=${days}`;

    const loadingSpinner = document.getElementById('loading-spinner');

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        rawApiResponseData = data;

        const weatherCardsContainer = document.getElementById('weather-cards');
        weatherCardsContainer.innerHTML = '';

        const colors = ['from-red-200 to-orange-300', 'from-teal-200 to-cyan-300', 'from-purple-200 to-indigo-300'];
        
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];

        let startIndex = data.forecast.forecastday.findIndex(day => day.date === todayDateString);
        if(startIndex === -1) startIndex = 0; 
        
        correctForecastData = data.forecast.forecastday.slice(startIndex, startIndex + 3);
        
        if (correctForecastData.length < 3) {
             showMessage('Data Issue', 'Could not retrieve a full three-day forecast. Displaying available data.');
        } else {
            // Pre-render the details table so it's ready to be shown
            renderDetailsTables();
        }
        
        correctForecastData.forEach((day, i) => {
            const date = new Date(day.date + 'T00:00:00');
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            
            // Use optional chaining and provide a fallback object to prevent errors
            const fallbackCondition = { condition: { icon: '', text: 'No data' } };
            const morningData = day.hour[10] ?? fallbackCondition;
            const morningRain = calculateRainfall(day.hour, 6, 11);

            const afternoonData = day.hour[15] ?? fallbackCondition;
            const afternoonRain = calculateRainfall(day.hour, 12, 17);

            const eveningData = day.hour[20] ?? fallbackCondition;
            const eveningRain = calculateRainfall(day.hour, 18, 23);

            const cardHtml = `
                <div class="relative p-6 rounded-3xl text-gray-900 shadow-xl hover:shadow-2xl hover:scale-105 transition-transform flex flex-col space-y-4 bg-gradient-to-br ${colors[i]} weather-card">
                    <div class="flex flex-col items-start">
                        <h2 class="text-3xl font-bold">${dayOfWeek}</h2>
                        <span class="text-xl font-bold">${Math.round(day.day.mintemp_f)}° / ${Math.round(day.day.maxtemp_f)}°</span>
                    </div>
                    
                    <div class="mt-4 space-y-2">
                        <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                            <span class="text-sm font-bold md:font-normal">Morning</span>
                            <img src="${morningData.condition.icon ? 'https:' + morningData.condition.icon : ''}" alt="Morning weather" class="w-8 h-8">
                            <span class="text-base font-medium md:text-sm md:font-normal">${morningData.condition.text} ${morningRain}</span>
                        </div>
                        <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                            <span class="text-sm font-bold md:font-normal">Afternoon</span>
                            <img src="${afternoonData.condition.icon ? 'https:' + afternoonData.condition.icon : ''}" alt="Afternoon weather" class="w-8 h-8">
                            <span class="text-base font-medium md:text-sm md:font-normal">${afternoonData.condition.text} ${afternoonRain}</span>
                        </div>
                        <div class="grid grid-cols-[60px,32px,1fr] items-center gap-2">
                            <span class="text-sm font-bold md:font-normal">Evening</span>
                            <img src="${eveningData.condition.icon ? 'https:' + eveningData.condition.icon : ''}" alt="Evening weather" class="w-8 h-8">
                            <span class="text-base font-medium md:text-sm md:font-normal">${eveningData.condition.text} ${eveningRain}</span>
                        </div>
                    </div>
                </div>
            `;
            weatherCardsContainer.innerHTML += cardHtml;
        });
        
    } catch (error) {
        console.error("Could not fetch weather data:", error);
        showMessage('Error', 'Failed to fetch weather data. Please check your connection or API key.');
    } finally {
        // This will run regardless of whether the fetch succeeded or failed.
        loadingSpinner.classList.add('hidden');
    }
}

// Initial fetch when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listener for the message box close button
    const closeButton = document.querySelector('#message-box button');
    if (closeButton) {
        closeButton.addEventListener('click', hideMessage);
    }
    // Attach event listener for the details toggle button
    document.getElementById('toggle-details-btn').addEventListener('click', toggleDetailsTable);
    fetchWeather('33598', 7);
});
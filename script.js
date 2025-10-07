    // ========== Configuration ==========
    // If you have a backend to receive SOS POSTs, set backendEnabled = true and backendUrl correctly.
    window.backendEnabled = false; // set true to enable real SOS POST
    window.backendUrl = 'http://localhost:5000'; // example backend

    // ========== Map initialization ==========
    const map = L.map('map').setView([26.2, 91.7], 9); // NE India region
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Monitoring station marker (circle)
    let stationLat = 26.2, stationLng = 91.7;
    let stationMarker = L.circle([stationLat, stationLng], { radius: 6000, color: 'green', fillOpacity: 0.12 }).addTo(map)
    .bindPopup('Monitoring Station: Zone A');

    // user location marker (if allowed)
    let userMarker = null;
    function setUserLocation(lat, lng) {
    if (userMarker) userMarker.setLatLng([lat, lng]);
    else {
        userMarker = L.marker([lat, lng], { icon: L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize: [25,41] }) }).addTo(map).bindPopup('You (approx.)');
    }
    }

    // Try to get user geolocation
    if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
        setUserLocation(pos.coords.latitude, pos.coords.longitude);
        // don't force pan if station is focus; minor pan:
        // map.panTo([pos.coords.latitude, pos.coords.longitude]);
    }, err => {
        console.log('Geolocation permission denied or unavailable.');
    });
    }

    // Place selector handler
    document.getElementById('centerPlaceBtn').addEventListener('click', () => {
    const v = document.getElementById('placeSelect').value;
    if (!v) return alert('Select a place from the dropdown.');
    const parts = v.split('|');
    const name = parts[0], lat = parseFloat(parts[1]), lng = parseFloat(parts[2]);
    map.setView([lat, lng], 11);
    L.popup().setLatLng([lat, lng]).setContent(`<b>${name}</b><br/>Lat:${lat}, Lng:${lng}`).openOn(map);
    });

    // ========== DOM references ==========
    const rainEl = document.getElementById('rain');
    const vibEl = document.getElementById('vibration');
    const moistEl = document.getElementById('moisture');
    const humidityEl = document.getElementById('humidity');
    const co2El = document.getElementById('co2');
    const tempEl = document.getElementById('temperature');
    const riskScoreEl = document.getElementById('riskScore');
    const riskTextEl = document.getElementById('riskText');
    const barsEl = document.getElementById('bars');

    const btn = document.getElementById("themeToggle");
    btn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        if (currentTheme === "dark") {
        document.documentElement.removeAttribute("data-theme");
        btn.textContent = "🌙 Dark Mode";
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      btn.textContent = "☀️ Light Mode";
    }
  });

    // ========== Rainfall history (bars) ==========
    let rainfallHistory = [20, 10, 40, 25, 30, 45, 50];

    // ========== Seismograph (Chart.js) ==========
    const seismoCtx = document.getElementById('seismoChart').getContext('2d');
    let seismoData = Array(40).fill(0);
    const seismoChart = new Chart(seismoCtx, {
    type: 'line',
    data: {
        labels: Array.from({length: 40}, (_, i) => i),
        datasets: [{
        label: 'Vibration Intensity',
        data: seismoData,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        pointRadius: 0,
        tension: 0.25
        }]
    },
    options: {
        responsive: true,
        animation: { duration: 300 },
        scales: { y: { beginAtZero: true, max: 400 } },
        plugins: { legend: { display: false } }
    }
    });

    // ========== Utility: draw bars ==========
    function drawBars() {
    barsEl.innerHTML = '';
    rainfallHistory.forEach(v => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        const h = Math.max(6, Math.min(80, v / 2)); // scale
        bar.style.height = h + 'px';
        barsEl.appendChild(bar);
    });
    }

    // ========== Risk logic & auto SOS ==========
    let lastAutoSOSAt = 0;
    const AUTO_SOS_COOLDOWN_MS = 1000 * 60 * 10; // 10 minutes cooldown

    function sendSOSToAuthority(payload) {
    // If backend is enabled, POST; else show demo popup and log
    if (window.backendEnabled) {
        fetch(window.backendUrl + '/api/sos/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
        }).then(r => r.json()).then(json => {
        console.log('SOS sent to backend:', json);
        alert('🚨 SOS sent to authority (backend)!');
        }).catch(err => {
        console.error('SOS error', err);
        alert('Error sending SOS to backend (see console).');
        });
    } else {
        console.log('Demo SOS payload ->', payload);
        alert('🚨 SOS Alert sent to authorities!\nLocation: ' + payload.lat.toFixed(4) + ',' + payload.lng.toFixed(4));
    }
    }

    const risk = (rain / 120) * 0.4 + (vibration / 8) * 0.4 + (moisture / 100) * 0.2;
  const riskScore = (risk * 100).toFixed(0);
  riskScoreEl.textContent = riskScore + "%";

  if (riskScore > 70) {
    riskScoreEl.className = "risk danger";
    riskTextEl.textContent = "⚠️ High Landslide Risk!";
  } else if (riskScore > 40) {
    riskScoreEl.className = "risk warning";
    riskTextEl.textContent = "⚠️ Moderate Risk - Monitor closely";
  } else {
    riskScoreEl.className = "risk safe";
    riskTextEl.textContent = "✅ Stable Condition";
  }

    // ========== Simulate / fetch sensor readings ==========
    function simulateSensorReadings() {
    // simulate measured values (or later replace by fetch())
    const rainfall = Math.floor(Math.random() * 160);     // mm/hr
    const vibration = Math.floor(Math.random() * 400);    // arbitrary units
    const moisture = Math.floor(Math.random() * 100);     // %
    const humidity = Math.floor(40 + Math.random() * 50); // %
    const co2 = Math.floor(380 + Math.random() * 80);     // ppm
    const temperature = (15 + Math.random() * 18).toFixed(1); // °C

    // update UI
    rainEl.textContent = rainfall + ' mm/hr';
    vibEl.textContent = vibration;
    moistEl.textContent = moisture + ' %';
    humidityEl.textContent = humidity + ' %';
    co2El.textContent = co2 + ' ppm';
    tempEl.textContent = temperature + ' °C';

    // update marker style & popup
    const isDanger = (rainfall > 120) || (vibration > 250) || (moisture > 80);
    stationMarker.setStyle({ color: isDanger ? 'red' : 'green' });
    stationMarker.bindPopup(`${isDanger ? '⚠️ Danger Zone' : '✅ Normal'}<br/>Rain: ${rainfall} mm/hr<br/>Vib: ${vibration}<br/>Moisture: ${moisture}%`);

    if (isDanger) stationMarker.openPopup();

    // update risk (weights)
    const score = Math.round(Math.min(100, (rainfall / 160 * 40) + (vibration / 400 * 40) + (moisture / 100 * 20)));
    updateRisk(score);

    // update rainfall history & bars
    rainfallHistory.shift();
    rainfallHistory.push(rainfall / 2);
    drawBars();

    // update seismograph data
    seismoData.shift();
    seismoData.push(vibration);
    seismoChart.data.datasets[0].data = seismoData;
    seismoChart.update();

    // auto SOS logic: if high risk and cooldown passed
    const now = Date.now();
    if (score >= 80 && (now - lastAutoSOSAt > AUTO_SOS_COOLDOWN_MS)) {
        lastAutoSOSAt = now;
        // attempt to get user coordinates for SOS payload; else use station coords
        if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const payload = {
            user: 'AUTOMATIC_SENSOR_ALERT',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            score,
            time: new Date().toISOString()
            };
            sendSOSToAuthority(payload);
        }, err => {
            const payload = { user: 'AUTOMATIC_SENSOR_ALERT', lat: stationLat, lng: stationLng, score, time: new Date().toISOString() };
            sendSOSToAuthority(payload);
        });
        } else {
        const payload = { user: 'AUTOMATIC_SENSOR_ALERT', lat: stationLat, lng: stationLng, score, time: new Date().toISOString() };
        sendSOSToAuthority(payload);
        }
    }
    }

    function updateRisk(score) {
    riskScoreEl.textContent = score + '/100';
    riskScoreEl.className = 'risk';
    if (score >= 70) { riskScoreEl.classList.add('danger'); riskTextEl.textContent = 'High landslide risk — Alert Authorities!'; }
    else if (score >= 40) { riskScoreEl.classList.add('warning'); riskTextEl.textContent = 'Moderate risk — Monitor closely.'; }
    else { riskTextEl.textContent = 'Low risk — Normal.'; }
    }

    // ========== SOS button (manual) ==========
    const sosBtn = document.getElementById('sosBtn');
    sosBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
        const payload = { user: 'Manual_Citizen', lat: pos.coords.latitude, lng: pos.coords.longitude, time: new Date().toISOString() };
        sendSOSToAuthority(payload);
        }, err => {
        alert('Geolocation blocked — sending station location instead.');
        const payload = { user: 'Manual_Citizen', lat: stationLat, lng: stationLng, time: new Date().toISOString() };
        sendSOSToAuthority(payload);
        });
    } else {
        const payload = { user: 'Manual_Citizen', lat: stationLat, lng: stationLng, time: new Date().toISOString() };
        sendSOSToAuthority(payload);
    }
    });

    // ========== Language switcher (small) ==========
    const language = document.getElementById('language');
    language.addEventListener('change', () => {
    const lang = language.value; const title = document.getElementById('title');
    if (lang === 'hi') title.textContent = 'लाइव IoT सेंसर डैशबोर्ड';
    else if (lang === 'te') title.textContent = 'లైవ్ IoT సెన్సార్ డాష్‌బోర్డ్';
    else if (lang === 'ur') title.textContent = 'لائیو IoT سینسر ڈیش بورڈ';
    else title.textContent = 'Live IoT Sensor Dashboard';
    });

    // ========== Start ==========
    simulateSensorReadings();
    setInterval(simulateSensorReadings, 5000); // update every 5s
    drawBars();

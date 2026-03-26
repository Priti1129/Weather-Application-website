const $ = (id) => document.getElementById(id);

// Weather code → emoji + text mapping (Open‑Meteo WMO)
const WMO = new Map([
  [[0], {e:'☀️', t:'Clear sky'}],
  [[1,2], {e:'🌤️', t:'Mostly clear'}],
  [[3], {e:'☁️', t:'Overcast'}],
  [[45,48], {e:'🌫️', t:'Fog'}],
  [[51,53,55], {e:'🌦️', t:'Drizzle'}],
  [[56,57], {e:'🌧️', t:'Freezing drizzle'}],
  [[61,63,65], {e:'🌧️', t:'Rain'}],
  [[66,67], {e:'🌧️', t:'Freezing rain'}],
  [[71,73,75], {e:'🌨️', t:'Snow'}],
  [[77], {e:'❄️', t:'Snow grains'}],
  [[80,81,82], {e:'🌦️', t:'Rain showers'}],
  [[85,86], {e:'🌨️', t:'Snow showers'}],
  [[95], {e:'⛈️', t:'Thunderstorm'}],
  [[96,99], {e:'⛈️', t:'Thunderstorm w/ hail'}],
].flatMap(([codes,val])=>codes.map(c=>[c,val])));

function formatTemp(v){ return (v!=null && isFinite(v)) ? `${Math.round(v)}°` : '—'; }
function wind(v){ return (v!=null && isFinite(v)) ? `${Math.round(v)} km/h` : '—'; }

async function geocode(q){
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if(!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  if(!data.length) throw new Error('No results found');
  const { lat, lon, display_name } = data[0];
  return { lat: +lat, lon: +lon, name: display_name };
}

async function reverseGeocode(lat, lon){
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if(!res.ok) return null;
  const data = await res.json();
  return data?.display_name || null;
}

async function getWeather(lat, lon){
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: ['temperature_2m','relative_humidity_2m','apparent_temperature','wind_speed_10m','weather_code'].join(','),
    daily: ['weather_code','temperature_2m_max','temperature_2m_min'].join(','),
    timezone: 'auto'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

function codeToDesc(code){
  const v = WMO.get(code) || {e:'❔', t:`Code ${code}`};
  return v;
}

function renderCurrent(name, data){
  const c = data.current;
  const {e,t} = codeToDesc(c.weather_code);
  $('place').textContent = name || '—';
  $('temp').textContent = formatTemp(c.temperature_2m);
  $('feels').textContent = formatTemp(c.apparent_temperature);
  $('humidity').textContent = `${c.relative_humidity_2m ?? '—'}%`;
  $('wind').textContent = wind(c.wind_speed_10m);
  $('emoji').textContent = e; $('bigEmoji').textContent = e;
  $('desc').textContent = t; $('bigDesc').textContent = t;
  const dt = new Date(c.time);
  $('badge').textContent = dt.toLocaleString(undefined, { hour:'2-digit', minute:'2-digit', weekday:'short' });
}

function renderForecast(daily){
  const root = $('forecast');
  root.innerHTML = '';
  const days = daily.time.length;
  for(let i=0; i<Math.min(days,5); i++){
    const code = daily.weather_code[i];
    const {e,t} = codeToDesc(code);
    const date = new Date(daily.time[i]);
    const el = document.createElement('div');
    el.className = 'day';
    el.innerHTML = `
      <div style="font-size:12px; color:var(--muted)">${date.toLocaleDateString(undefined,{weekday:'short'})}</div>
      <div class="emoji">${e}</div>
      <div style="font-size:12px; color:var(--muted)">${t}</div>
      <div class="minmax">${Math.round(daily.temperature_2m_min[i])}° / ${Math.round(daily.temperature_2m_max[i])}°</div>
    `;
    root.appendChild(el);
  }
}

async function loadByCoords(lat, lon, label){
  try{
    $('error').textContent = '';
    const name = label || await reverseGeocode(lat, lon) || `Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}`;
    const data = await getWeather(lat, lon);
    renderCurrent(name, data);
    renderForecast(data.daily);
  }catch(err){
    $('error').textContent = err.message || String(err);
  }
}

async function onSearch(){
  const q = $('query').value.trim();
  if(!q) return;
  const g = await geocode(q);
  await loadByCoords(g.lat, g.lon, g.name);
}

window.addEventListener('DOMContentLoaded', () => {
  $('searchBtn').addEventListener('click', onSearch);
  $('query').addEventListener('keydown', (e)=>{ if(e.key==='Enter') onSearch(); });
  $('geoBtn').addEventListener('click', ()=>{
    if(!navigator.geolocation){ $('error').textContent = 'Geolocation not supported.'; return; }
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        const { latitude:lat, longitude:lon } = pos.coords;
        loadByCoords(lat, lon, 'My location');
      },
      (err)=>{ $('error').textContent = err.message || 'Location permission denied.'; }
    );
  });

  // Initial demo load: Indore, India
  loadByCoords(22.7196, 75.8577, 'Indore, India');
});
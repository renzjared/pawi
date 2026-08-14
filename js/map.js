let miniMap, fullMap, contribMap;
let markerLayerMini, markerLayerFull, contribMarker;
let allLocations = [];

const defaultCoords = [14.6760, 121.0437]; 
let userCoords = defaultCoords;

function getMarkerColor(access) {
    if (access === 'Public') return '#58CC02'; 
    if (access === 'Customers Only') return '#FF9600'; 
    return '#FF4B4B'; 
}

function createCustomIcon(access) {
    const color = getMarkerColor(access);
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div class="custom-marker" style="background-color: ${color};"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

// Reverse Geocoding to get address details from map tap
async function autoFillAddress(lat, lng) {
    const line1Input = document.getElementById('loc-line1');
    line1Input.value = "Detecting address...";
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data && data.address) {
            // Build a sensible Address Line 1 from OSM data
            const building = data.address.building || data.address.amenity || '';
            const street = data.address.road || '';
            const parts = [building, street].filter(Boolean);
            
            line1Input.value = parts.join(', ') || "Address not found automatically";
        } else {
            line1Input.value = "";
        }
    } catch (error) {
        console.error("Reverse geocoding failed", error);
        line1Input.value = "";
    }
}

function initMaps() {
    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    miniMap = L.map('mini-map', { zoomControl: false, scrollWheelZoom: false }).setView(userCoords, 14);
    L.tileLayer(tileUrl).addTo(miniMap);
    markerLayerMini = L.layerGroup().addTo(miniMap);

    fullMap = L.map('full-map').setView(userCoords, 14);
    L.tileLayer(tileUrl).addTo(fullMap);
    markerLayerFull = L.layerGroup().addTo(fullMap);

    contribMap = L.map('contrib-map').setView(userCoords, 14);
    L.tileLayer(tileUrl).addTo(contribMap);
    
    contribMap.on('click', function(e) {
        if (contribMarker) contribMap.removeLayer(contribMarker);
        contribMarker = L.marker(e.latlng).addTo(contribMap);
        
        const coordsInput = document.getElementById('loc-coords');
        coordsInput.value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
        coordsInput.dataset.lat = e.latlng.lat;
        coordsInput.dataset.lng = e.latlng.lng;
        coordsInput.style.background = '#FFFFFF';
        coordsInput.style.borderColor = '#1CB0F6';

        // Trigger Reverse Geocoding
        autoFillAddress(e.latlng.lat, e.latlng.lng);
    });

    fullMap.locate({setView: false, maxZoom: 15});
    fullMap.on('locationfound', function(e) {
        userCoords = [e.latlng.lat, e.latlng.lng];
        miniMap.setView(userCoords, 14);
        fullMap.setView(userCoords, 14);
        contribMap.setView(userCoords, 14);
        
        const userDotOptions = { radius: 8, fillColor: "#1CB0F6", color: "#FFFFFF", weight: 3, fillOpacity: 1 };
        L.circleMarker(e.latlng, userDotOptions).addTo(fullMap);
        L.circleMarker(e.latlng, userDotOptions).addTo(miniMap);
        L.circleMarker(e.latlng, userDotOptions).addTo(contribMap);
    });
}

async function geocodeLocation(query, targetMap) {
    if (!query) return;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            targetMap.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 15);
        } else {
            alert("Location not found. Try adding a city name.");
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
}

function plotLocations(locations, filter = 'all') {
    markerLayerMini.clearLayers();
    markerLayerFull.clearLayers();
    const listContainer = document.getElementById('locations-list');
    listContainer.innerHTML = '';

    locations.forEach(loc => {
        if (filter !== 'all' && loc.access !== filter) return;

        const icon = createCustomIcon(loc.access);
        const badgeClass = loc.access === 'Public' ? 'public' : (loc.access === 'Customers Only' ? 'customers' : 'restricted');
        
        const popupContent = `
            <div style="font-family: 'Nunito', sans-serif;">
                <h3 style="color:#1CB0F6; margin:0 0 5px 0;">${loc.name}</h3>
                <p style="margin: 0;"><b>Type:</b> ${loc.type}</p>
                <p style="margin: 0;"><b>Access:</b> ${loc.access}</p>
            </div>
        `;

        L.marker([loc.lat, loc.lng], { icon: icon }).bindPopup(popupContent).addTo(markerLayerFull);
        L.marker([loc.lat, loc.lng], { icon: icon }).addTo(markerLayerMini);

        const card = document.createElement('div');
        card.className = 'loc-card';
        card.innerHTML = `
            <h4>${loc.name}</h4>
            <span class="badge ${badgeClass}">${loc.access}</span>
            <p style="font-size:14px; margin:0; color:#777; font-weight: 700;">📍 ${loc.building || loc.street || 'View on map'}</p>
        `;
        
        card.addEventListener('click', () => {
            fullMap.setView([loc.lat, loc.lng], 17);
        });

        listContainer.appendChild(card);
    });
}
let miniMap, fullMap, contribMap;
let markerLayerMini, markerLayerFull, contribMarker;
let allLocations = [];

const defaultCoords = [14.6760, 121.0437]; 
let userCoords = defaultCoords; // Will update based on GPS or Search

// SVG Map Pin Icon
const pinSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="svg-icon"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
const routingSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="svg-icon"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>`;

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

// Haversine formula to calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function formatDistance(distKm) {
    if (distKm < 1) return `${Math.round(distKm * 1000)} m away`;
    return `${distKm.toFixed(1)} km away`;
}

// ... [Keep your existing initMaps and autoFillAddress functions exactly as they were] ...
async function autoFillAddress(lat, lng) {
    const line1Input = document.getElementById('loc-line1');
    line1Input.value = "Detecting address...";
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        if (data && data.address) {
            const building = data.address.building || data.address.amenity || '';
            const street = data.address.road || '';
            const parts = [building, street].filter(Boolean);
            line1Input.value = parts.join(', ') || "Address not found automatically";
        } else {
            line1Input.value = "";
        }
    } catch (error) {
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
        autoFillAddress(e.latlng.lat, e.latlng.lng);
    });

    fullMap.locate({setView: false, maxZoom: 15});
    fullMap.on('locationfound', function(e) {
        userCoords = [e.latlng.lat, e.latlng.lng]; // Update global center point
        miniMap.setView(userCoords, 14);
        fullMap.setView(userCoords, 14);
        contribMap.setView(userCoords, 14);
        const userDotOptions = { radius: 8, fillColor: "#1CB0F6", color: "#FFFFFF", weight: 3, fillOpacity: 1 };
        L.circleMarker(e.latlng, userDotOptions).addTo(fullMap);
        L.circleMarker(e.latlng, userDotOptions).addTo(miniMap);
        L.circleMarker(e.latlng, userDotOptions).addTo(contribMap);
        
        // Re-plot to calculate distances from this new GPS location
        if(allLocations.length > 0) window.triggerPlotting();
    });
}
// ... [End kept block] ...

async function geocodeLocation(query, targetMap) {
    if (!query) return;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            targetMap.setView([lat, lon], 15);
            
            // Update reference coordinates and resort list
            userCoords = [lat, lon];
            window.triggerPlotting();
        } else {
            alert("Location not found. Try adding a city name.");
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
}

// Accepts an object of multiple filters
function plotLocations(locations, filters = { access: 'all', type: 'all', setting: 'all' }) {
    markerLayerMini.clearLayers();
    markerLayerFull.clearLayers();
    const listContainer = document.getElementById('locations-list');
    listContainer.innerHTML = '';

    // 1. Filter & Calculate Distance
    let processedLocs = locations.filter(loc => {
        let passAccess = filters.access === 'all' || loc.access === filters.access;
        let passType = filters.type === 'all' || loc.type === filters.type;
        let passSetting = filters.setting === 'all' || loc.indoor_outdoor === filters.setting;
        return passAccess && passType && passSetting;
    }).map(loc => {
        loc.distance = calculateDistance(userCoords[0], userCoords[1], loc.lat, loc.lng);
        return loc;
    });

    // 2. Sort by distance (Nearest first)
    processedLocs.sort((a, b) => a.distance - b.distance);

    // 3. Render
    processedLocs.forEach(loc => {
        const color = getMarkerColor(loc.access);
        const icon = createCustomIcon(loc.access);
        const badgeClass = loc.access === 'Public' ? 'public' : (loc.access === 'Customers Only' ? 'customers' : 'restricted');
        
        // Build Rich Popup formatting
        let addressText = [loc.address_line1, loc.address_line2, loc.barangay, loc.city].filter(Boolean).join(', ');
        const popupContent = `
            ${loc.image_url ? `<img src="${loc.image_url}" class="popup-image" alt="Location Photo">` : ''}
            <div class="popup-details">
                <h3>${loc.name}</h3>
                <div class="popup-badges">
                    <span class="badge ${badgeClass}">${loc.access}</span>
                    <span class="popup-badge">${loc.type}</span>
                    <span class="popup-badge">${loc.indoor_outdoor || 'Unknown Setting'}</span>
                </div>
                <p class="popup-address">${pinSvg} <span>${addressText}</span></p>
                ${loc.notes ? `<p class="popup-notes">"${loc.notes}"</p>` : ''}
            </div>
        `;

        // Build Hover Tooltip
        const tooltipHTML = `<span class="tooltip-dot" style="background-color:${color};"></span> ${loc.name}`;

        // Add to map with Bindings
        const marker = L.marker([loc.lat, loc.lng], { icon: icon })
            .bindPopup(popupContent)
            .bindTooltip(tooltipHTML, { direction: 'top', offset: [0, -10], className: 'custom-tooltip' });
            
        marker.addTo(markerLayerFull);
        L.marker([loc.lat, loc.lng], { icon: icon }).addTo(markerLayerMini);

        // Sidebar Card
        const card = document.createElement('div');
        card.className = 'loc-card';
        card.innerHTML = `
            <h4>${loc.name}</h4>
            <span class="badge ${badgeClass}">${loc.access}</span>
            <p style="font-size:14px; margin:0; color:#777; font-weight: 700; display:flex; gap:6px;">${pinSvg} ${loc.address_line1 || loc.city || 'View on map'}</p>
            <p class="distance-text">${routingSvg} ${formatDistance(loc.distance)}</p>
        `;
        
        card.addEventListener('click', () => {
            fullMap.setView([loc.lat, loc.lng], 17);
            marker.openPopup();
        });

        listContainer.appendChild(card);
    });
}
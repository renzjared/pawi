let miniMap, fullMap;
let markerLayerMini, markerLayerFull;
let allLocations = [];

// Fallback to Quezon City coordinates before GPS kicks in
const defaultCoords = [14.6760, 121.0437]; 
let userCoords = defaultCoords;

function getMarkerColor(access) {
    if (access === 'Public') return '#58CC02'; // Green
    if (access === 'Customers Only') return '#FF9600'; // Orange
    return '#FF4B4B'; // Red for Restricted or Others
}

function createCustomIcon(access) {
    const color = getMarkerColor(access);
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div class="custom-marker" style="background-color: ${color};"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function initMaps() {
    // 1. Initialize Mini Map
    miniMap = L.map('mini-map', { zoomControl: false }).setView(userCoords, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap);
    markerLayerMini = L.layerGroup().addTo(miniMap);

    // 2. Initialize Full Map
    fullMap = L.map('full-map').setView(userCoords, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(fullMap);
    markerLayerFull = L.layerGroup().addTo(fullMap);

    // Geolocation to center on user
    fullMap.locate({setView: true, maxZoom: 15});
    fullMap.on('locationfound', function(e) {
        userCoords = [e.latlng.lat, e.latlng.lng];
        miniMap.setView(userCoords, 14);
        
        // Add a simple blue dot for the user
        L.circleMarker(e.latlng, { radius: 6, fillColor: "#1CB0F6", color: "#FFFFFF", weight: 2, fillOpacity: 1 }).addTo(fullMap).addTo(miniMap);
    });
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
        
        // Popup Content
        const popupContent = `
            <div style="font-family: 'Nunito', sans-serif;">
                <h3 style="color:#1CB0F6; margin:0 0 5px 0;">${loc.name}</h3>
                <p style="margin: 0;"><b>Type:</b> ${loc.type}</p>
                <p style="margin: 0;"><b>Access:</b> ${loc.access}</p>
            </div>
        `;

        // Add to Maps
        L.marker([loc.lat, loc.lng], { icon: icon }).bindPopup(popupContent).addTo(markerLayerFull);
        L.marker([loc.lat, loc.lng], { icon: icon }).addTo(markerLayerMini);

        // Add to Sidebar List
        const card = document.createElement('div');
        card.className = 'loc-card';
        card.innerHTML = `
            <h4>${loc.name}</h4>
            <span class="badge ${badgeClass}">${loc.access}</span>
            <p style="font-size:14px; margin:0; color:#777;">📍 ${loc.building || loc.street || 'View on map'}</p>
        `;
        
        // Clicking a card zooms the full map to that location
        card.addEventListener('click', () => {
            fullMap.setView([loc.lat, loc.lng], 17);
            // Optionally open the popup here
        });

        listContainer.appendChild(card);
    });
}
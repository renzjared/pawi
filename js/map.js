let map, markerLayer, tempMarker;

function initMap() {
    // Default to Manila
    map = L.map('map').setView([14.5995, 120.9842], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    // Allow user to pick coordinates for a new submission
    map.on('click', function(e) {
        if (tempMarker) map.removeLayer(tempMarker);
        
        tempMarker = L.marker(e.latlng).addTo(map);
        
        // Auto-fill the coordinate input on the Add Form
        const coordsInput = document.getElementById('loc-coords');
        coordsInput.value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
        coordsInput.dataset.lat = e.latlng.lat;
        coordsInput.dataset.lng = e.latlng.lng;
    });
}

function plotLocations(locations) {
    markerLayer.clearLayers();
    
    locations.forEach(loc => {
        const popupContent = `
            <div style="font-family: 'Nunito', sans-serif;">
                <h3 style="color:#1CB0F6; margin:0 0 5px 0;">${loc.name}</h3>
                <p style="margin: 0;"><b>Type:</b> ${loc.type} (${loc.indoor_outdoor})</p>
                <p style="margin: 0;"><b>Access:</b> ${loc.access}</p>
                <p style="margin: 5px 0;">📍 ${loc.floor ? 'Flr ' + loc.floor + ',' : ''} ${loc.building ? loc.building : ''} ${loc.street ? loc.street : ''}</p>
                ${loc.notes ? `<p style="font-size:12px; color:#888;">${loc.notes}</p>` : ''}
                ${loc.image_url ? `<img src="${loc.image_url}" style="width:100%; border-radius:8px; margin-top:8px;">` : ''}
            </div>
        `;
        
        L.marker([loc.lat, loc.lng])
         .bindPopup(popupContent)
         .addTo(markerLayer);
    });
}
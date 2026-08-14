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

    fullMap.locate({
        setView: false, 
        maxZoom: 15, 
        enableHighAccuracy: true, /* Forces device GPS over Wi-Fi guessing */
        timeout: 10000 /* Gives the browser 10 seconds to find the exact pin */
    });
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

// 1. Pre-calculate dynamic state
        const currentUserId = window.currentUser ? window.currentUser.id : null;
        const myVote = loc.votes ? (loc.votes.find(v => v.user_id === currentUserId)?.vote_value || 0) : 0;
        const score = loc.votes ? loc.votes.reduce((sum, v) => sum + v.vote_value, 0) : 0;
        
        // 2. Build the Comments HTML
        let commentsHtml = '';
        if (loc.comments && loc.comments.length > 0) {
            commentsHtml = loc.comments.map(c => {
                const author = c.user_id === currentUserId ? "You" : (c.user_id ? "Water Scout" : "Guest");
                const timeStr = new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return `
                    <div class="comment-item">
                        <div class="comment-header">
                            <span class="comment-author">${author}</span>
                            <span>${timeStr}</span>
                        </div>
                        <div>${c.content}</div>
                    </div>
                `;
            }).join('');
        } else {
            commentsHtml = '<p class="no-comments" style="font-size:12px; color:var(--text-light); font-style:italic; margin:0;">No comments yet. Be the first!</p>';
        }

        // 3. Build the Rich Popup with strict IDs for DOM Manipulation
        const popupContent = `
            ${loc.image_url ? `<img src="${loc.image_url}" class="popup-image" alt="Location Photo">` : ''}
            <div class="popup-details">
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <h3 style="margin: 0; padding-right: 12px; line-height: 1.1;">${loc.name}</h3>
                    
                    <!-- UPVOTE / DOWNVOTE UI -->
                    <div style="display: flex; align-items: center; gap: 6px; background: var(--bg-page); padding: 4px 8px; border-radius: 20px; border: 1px solid var(--border-color);">
                        <button id="upvote-${loc.id}" class="vote-btn ${myVote === 1 ? 'active-up' : ''}" onclick="window.handleVote('${loc.id}', 1)">▲</button>
                        <span id="score-${loc.id}" style="font-weight:800; font-size:14px; color:var(--text-main); min-width:14px; text-align:center;">${score}</span>
                        <button id="downvote-${loc.id}" class="vote-btn ${myVote === -1 ? 'active-down' : ''}" onclick="window.handleVote('${loc.id}', -1)">▼</button>
                    </div>
                </div>

                <div class="popup-badges">
                    <span class="badge ${badgeClass}">${loc.access}</span>
                    <span class="popup-badge">${loc.type}</span>
                </div>
                
                <p class="popup-address">${pinSvg} <span>${addressText}</span></p>
                ${loc.notes ? `<p class="popup-notes">"${loc.notes}"</p>` : ''}
                
                <!-- COMMENTS UI -->
                <div style="margin-top: 16px; border-top: 2px solid var(--border-color); padding-top: 12px;">
                    <h4 style="font-size:14px; color:var(--primary-dark); font-weight:800; margin:0 0 8px 0;">Community Notes</h4>
                    
                    <div id="comments-list-${loc.id}" style="max-height: 140px; overflow-y: auto; margin-bottom: 12px; padding-right: 4px;">
                        ${commentsHtml}
                    </div>
                    
                    <div style="display:flex; gap:6px;">
                        <!-- Added an onkeypress so users can hit Enter to submit -->
                        <input type="text" id="comment-input-${loc.id}" placeholder="Add a tip..." style="flex:1; padding:8px; border:2px solid var(--border-color); border-radius:8px; font-size:12px; font-family:'Nunito', sans-serif;" onkeypress="if(event.key === 'Enter') window.handleComment('${loc.id}')">
                        <button onclick="window.handleComment('${loc.id}')" class="btn-primary" style="padding:8px 12px; font-size:12px;">Post</button>
                    </div>
                </div>
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
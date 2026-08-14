document.addEventListener('DOMContentLoaded', async () => {
    initMaps();

    const routeLinks = document.querySelectorAll('.tab-link');
    const modules = document.querySelectorAll('.module');
    const navBtns = document.querySelectorAll('.tab-btn');

    routeLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;

            navBtns.forEach(b => b.classList.remove('active'));
            const matchingNavBtn = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
            if (matchingNavBtn) matchingNavBtn.classList.add('active');

            modules.forEach(m => m.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            setTimeout(() => {
                if (targetId === 'map-view') fullMap.invalidateSize();
                if (targetId === 'landing-view') miniMap.invalidateSize();
                if (targetId === 'add-view') contribMap.invalidateSize();
            }, 100);
            
            document.getElementById('main-content').scrollTo(0,0);
        });
    });

    document.getElementById('map-search-btn').addEventListener('click', () => {
        const query = document.getElementById('map-search-input').value;
        geocodeLocation(query, fullMap);
    });
    
    document.getElementById('map-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') geocodeLocation(e.target.value, fullMap);
    });

    document.getElementById('filter-access').addEventListener('change', (e) => {
        plotLocations(allLocations, e.target.value);
    });

    // --- NEW: FORM SUBMISSION & LOCAL SAVING ---
    const form = document.getElementById('add-location-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const coordsInput = document.getElementById('loc-coords');
        if (!coordsInput.dataset.lat) {
            alert("Please tap the map to pinpoint the location first.");
            return;
        }

        // Create a local mock object
        const newLocation = {
            id: Date.now(),
            name: document.getElementById('loc-name').value,
            type: document.getElementById('loc-type').value,
            access: document.getElementById('loc-access').value,
            street: document.getElementById('loc-line1').value,
            lat: parseFloat(coordsInput.dataset.lat),
            lng: parseFloat(coordsInput.dataset.lng)
        };

        // Add to our active session array and re-render the map
        allLocations.push(newLocation);
        plotLocations(allLocations, document.getElementById('filter-access').value);

        alert("Hydration spot added successfully! It is now visible on the map.");
        
        // Reset form and jump to map view
        form.reset();
        coordsInput.dataset.lat = '';
        coordsInput.dataset.lng = '';
        document.querySelector('.tab-btn[data-target="map-view"]').click();
        
        // Center full map on the new location
        setTimeout(() => {
            fullMap.setView([newLocation.lat, newLocation.lng], 16);
        }, 200);
    });

});
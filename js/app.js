document.addEventListener('DOMContentLoaded', async () => {
    initMaps();

    // Routing Logic
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

    // Map Searching and Filtering
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

    // Live Supabase Form Submission
    const form = document.getElementById('add-location-form');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const coordsInput = document.getElementById('loc-coords');
        if (!coordsInput.dataset.lat) {
            alert("Please tap the map to pinpoint the location first.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        try {
            // Optional Image Upload
            let imageUrl = null;
            const fileInput = document.getElementById('loc-image');
            if (fileInput.files.length > 0) {
                imageUrl = await uploadImageToSupabase(fileInput.files[0]);
            }

            // Construct Payload with new fields
            const payload = {
                name: document.getElementById('loc-name').value,
                type: document.getElementById('loc-type').value,
                setting: document.getElementById('loc-setting').value,
                access: document.getElementById('loc-access').value,
                line1: document.getElementById('loc-line1').value,
                line2: document.getElementById('loc-line2').value,
                province: document.getElementById('loc-province').value,
                city: document.getElementById('loc-city').value,
                barangay: document.getElementById('loc-barangay').value,
                postal: document.getElementById('loc-postal').value,
                notes: document.getElementById('loc-notes').value,
                imageUrl: imageUrl,
                lat: coordsInput.dataset.lat,
                lng: coordsInput.dataset.lng
            };

            // Save to DB
            submitBtn.textContent = 'Saving Location...';
            await saveLocationToDB(payload);

            alert('Awesome! Location added successfully to the live map.');
            form.reset();
            coordsInput.dataset.lat = '';
            coordsInput.dataset.lng = '';
            
            // Switch back to map view 
            document.querySelector('.tab-btn[data-target="map-view"]').click();
            
            // Re-fetch and plot all locations to include the new one
            allLocations = await fetchAllLocations();
            plotLocations(allLocations, document.getElementById('filter-access').value);
            
            // Pan to new location
            setTimeout(() => {
                fullMap.setView([payload.lat, payload.lng], 16);
            }, 200);
            
        } catch (error) {
            console.error(error);
            alert('Oops! Something went wrong: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Location';
        }
    });

    // Initial load of live pins from Supabase
    try {
        allLocations = await fetchAllLocations(); 
        plotLocations(allLocations, 'all');
    } catch (error) {
        console.error('Failed to load map pins:', error);
    }
});
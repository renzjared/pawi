document.addEventListener('DOMContentLoaded', async () => {
    initMap();

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const modules = document.querySelectorAll('.module');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update UI tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Switch modules
            modules.forEach(m => m.classList.remove('active'));
            document.getElementById(btn.dataset.target).classList.add('active');
            
            // Fix map sizing bug when switching from hidden tab
            if (btn.dataset.target === 'map-view') {
                map.invalidateSize();
                loadPins();
            }
        });
    });

    // Form Submission
    const form = document.getElementById('add-location-form');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('loc-image');
        const coordsInput = document.getElementById('loc-coords');

        if (!coordsInput.dataset.lat) {
            alert('Please tap on the map to set the location coordinates first!');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        try {
            // 1. Upload image to Imgur
            const imageUrl = await uploadToImgur(fileInput.files[0]);

            // 2. Prepare payload
            const payload = {
                name: document.getElementById('loc-name').value,
                type: document.getElementById('loc-type').value,
                setting: document.getElementById('loc-setting').value,
                access: document.getElementById('loc-access').value,
                building: document.getElementById('loc-building').value,
                floor: document.getElementById('loc-floor').value,
                street: document.getElementById('loc-street').value,
                notes: document.getElementById('loc-notes').value,
                imageUrl: imageUrl,
                lat: coordsInput.dataset.lat,
                lng: coordsInput.dataset.lng
            };

            // 3. Save to Supabase PostGIS
            submitBtn.textContent = 'Saving Location...';
            await saveLocationToDB(payload);

            alert('Awesome! Location added successfully.');
            form.reset();
            coordsInput.dataset.lat = '';
            coordsInput.dataset.lng = '';
            
            // Switch back to map view to see the new pin
            document.querySelector('[data-target="map-view"]').click();
            
        } catch (error) {
            console.error(error);
            alert('Oops! Something went wrong: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Location';
        }
    });

    // Initial load of pins
    loadPins();
});

async function loadPins() {
    try {
        const locations = await fetchAllLocations();
        plotLocations(locations);
    } catch (error) {
        console.error('Failed to load map pins:', error);
    }
}
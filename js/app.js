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

    // Map Searching
    document.getElementById('map-search-btn').addEventListener('click', () => {
        geocodeLocation(document.getElementById('map-search-input').value, fullMap);
    });
    document.getElementById('map-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') geocodeLocation(e.target.value, fullMap);
    });

    // Image Upload Toggler
    document.getElementById('loc-image-type').addEventListener('change', (e) => {
        document.getElementById('group-image-file').style.display = e.target.value === 'file' ? 'block' : 'none';
        document.getElementById('group-image-url').style.display = e.target.value === 'url' ? 'block' : 'none';
    });

    // MULTI-FILTER LOGIC
    window.triggerPlotting = () => {
        const currentFilters = {
            access: document.getElementById('filter-access').value,
            type: document.getElementById('filter-type').value,
            setting: document.getElementById('filter-setting').value
        };
        plotLocations(allLocations, currentFilters);
    };

    // Attach listener to all dropdowns
    document.querySelectorAll('.filter-trigger').forEach(select => {
        select.addEventListener('change', window.triggerPlotting);
    });

    // Live Supabase Form Submission
    const form = document.getElementById('add-location-form');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const coordsInput = document.getElementById('loc-coords');
        if (!coordsInput.dataset.lat) return alert("Please tap the map to pinpoint the location first.");

        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        try {
            let imageUrl = null;
            const imageType = document.getElementById('loc-image-type').value;
            
            if (imageType === 'file') {
                const fileInput = document.getElementById('loc-image-file');
                if (fileInput.files.length > 0) imageUrl = await uploadImageToSupabase(fileInput.files[0]);
            } else if (imageType === 'url') {
                const urlInput = document.getElementById('loc-image-url').value;
                if (urlInput.trim() !== '') imageUrl = urlInput.trim();
            }

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
                notes: document.getElementById('loc-notes').value,
                imageUrl: imageUrl,
                lat: coordsInput.dataset.lat,
                lng: coordsInput.dataset.lng
            };

            submitBtn.textContent = 'Saving Location...';
            await saveLocationToDB(payload);
            alert('Awesome! Location added successfully to the live map.');
            form.reset();
            coordsInput.dataset.lat = ''; coordsInput.dataset.lng = '';
            
            document.querySelector('.tab-btn[data-target="map-view"]').click();
            allLocations = await fetchAllLocations();
            window.triggerPlotting();
            
            setTimeout(() => fullMap.setView([payload.lat, payload.lng], 16), 200);
            
        } catch (error) {
            console.error(error);
            alert('Oops! Something went wrong: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Location';
        }
    });

    // Initial load
    try {
        allLocations = await fetchAllLocations(); 
        window.triggerPlotting();
    } catch (error) {
        console.error('Failed to load map pins:', error);
    }
});
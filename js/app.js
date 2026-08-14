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

    // Attach listener to all filter dropdowns
    document.querySelectorAll('.filter-trigger').forEach(select => {
        select.addEventListener('change', window.triggerPlotting);
    });

    // AUTHENTICATION LOGIC (Google OAuth via Supabase)
    const authModal = document.getElementById('auth-modal');
    const loginBtn = document.getElementById('nav-login-btn');
    let currentUser = null;

    loginBtn.addEventListener('click', () => {
        if (!currentUser) authModal.style.display = 'flex';
        else alert("You are logged in! Your user ID is: " + currentUser.id);
    });

    document.getElementById('close-auth-btn').addEventListener('click', () => {
        authModal.style.display = 'none';
    });

    // Trigger Google OAuth Flow
    document.getElementById('btn-google').addEventListener('click', async () => {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });
        if (error) alert("Authentication Error: " + error.message);
    });

    // Check existing session on load
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            loginBtn.textContent = "My Account";
        }
    });

    // Listen for OAuth redirect return (State Change)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            loginBtn.textContent = "My Account";
            authModal.style.display = 'none';
        }
    });

    // Live Supabase Form Submission (No Postal Code)
    const form = document.getElementById('add-location-form');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Ensure user is logged in before allowing submission
        if (!currentUser) {
            authModal.style.display = 'flex';
            return alert("You must be signed in to add a hydration spot.");
        }

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

    // Initial load of map pins
    try {
        allLocations = await fetchAllLocations(); 
        window.triggerPlotting();
    } catch (error) {
        console.error('Failed to load map pins:', error);
    }
});
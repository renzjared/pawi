document.addEventListener('DOMContentLoaded', async () => {
    initMaps();

    // Routing Logic (Handles Navbar tabs AND buttons on the page)
    const routeLinks = document.querySelectorAll('.tab-link');
    const modules = document.querySelectorAll('.module');
    const navBtns = document.querySelectorAll('.tab-btn');

    routeLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;

            // Update Navbar Active State
            navBtns.forEach(b => b.classList.remove('active'));
            const matchingNavBtn = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
            if (matchingNavBtn) matchingNavBtn.classList.add('active');

            // Switch Modules
            modules.forEach(m => m.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // Critical fix for Leaflet Map Sizing when container becomes visible
            setTimeout(() => {
                if (targetId === 'map-view') fullMap.invalidateSize();
                if (targetId === 'landing-view') miniMap.invalidateSize();
                if (targetId === 'add-view') contribMap.invalidateSize();
            }, 100);
            
            // Scroll to top
            document.getElementById('main-content').scrollTo(0,0);
        });
    });

    // Map View Search Listener
    document.getElementById('map-search-btn').addEventListener('click', () => {
        const query = document.getElementById('map-search-input').value;
        geocodeLocation(query, fullMap);
    });
    
    // Support pressing "Enter" on Map View search
    document.getElementById('map-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            geocodeLocation(e.target.value, fullMap);
        }
    });

    // Filter Logic
    document.getElementById('filter-access').addEventListener('change', (e) => {
        plotLocations(allLocations, e.target.value);
    });

    // Uncomment when Database is connected
    try {
        allLocations = await fetchAllLocations(); 
        plotLocations(allLocations, 'all');
    } catch (error) {
        console.error('Failed to load map pins:', error);
    }
});
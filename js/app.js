document.addEventListener('DOMContentLoaded', async () => {
    initMaps();

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const modules = document.querySelectorAll('.module');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            modules.forEach(m => m.classList.remove('active'));
            const targetModule = document.getElementById(btn.dataset.target);
            targetModule.classList.add('active');
            
            // Fix Leaflet sizing bug when container becomes visible
            if (btn.dataset.target === 'map-view') {
                setTimeout(() => fullMap.invalidateSize(), 100);
            }
            if (btn.dataset.target === 'landing-view') {
                setTimeout(() => miniMap.invalidateSize(), 100);
            }
        });
    });

    // Filter Logic
    document.getElementById('filter-access').addEventListener('change', (e) => {
        plotLocations(allLocations, e.target.value);
    });

    // Initial load of pins
    await loadPins();
});

async function loadPins() {
    try {
        allLocations = await fetchAllLocations(); // Assumes this is in supabase.js
        plotLocations(allLocations, 'all');
    } catch (error) {
        console.error('Failed to load map pins:', error);
    }
}
// Uses the free PSGC API to populate Philippine location dropdowns
const PSGC_BASE_URL = 'https://psgc.gitlab.io/api';

document.addEventListener('DOMContentLoaded', async () => {
    const provSelect = document.getElementById('loc-province');
    const citySelect = document.getElementById('loc-city');
    const brgySelect = document.getElementById('loc-barangay');

    try {
        // Fetch Provinces & NCR (Regions) to populate the first dropdown
        const [provincesRes, ncrRes] = await Promise.all([
            fetch(`${PSGC_BASE_URL}/provinces/`),
            fetch(`${PSGC_BASE_URL}/regions/130000000/cities-municipalities/`) // Metro Manila cities
        ]);
        
        const provinces = await provincesRes.json();
        const ncrCities = await ncrRes.json();

        provSelect.innerHTML = '<option value="">Select Province / Region</option>';
        provSelect.innerHTML += '<option value="NCR" data-code="NCR">Metro Manila (NCR)</option>';

        // Sort alphabetically
        provinces.sort((a, b) => a.name.localeCompare(b.name)).forEach(prov => {
            provSelect.innerHTML += `<option value="${prov.name}" data-code="${prov.code}">${prov.name}</option>`;
        });

        // Handle Province Change
        provSelect.addEventListener('change', async (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const code = selectedOption.dataset.code;
            
            citySelect.innerHTML = '<option value="">Loading Cities...</option>';
            citySelect.disabled = true;
            brgySelect.innerHTML = '<option value="">Select City First</option>';
            brgySelect.disabled = true;

            let cities = [];
            if (code === 'NCR') {
                cities = ncrCities;
            } else if (code) {
                const res = await fetch(`${PSGC_BASE_URL}/provinces/${code}/cities-municipalities/`);
                cities = await res.json();
            }

            citySelect.innerHTML = '<option value="">Select City / Municipality</option>';
            cities.sort((a, b) => a.name.localeCompare(b.name)).forEach(city => {
                citySelect.innerHTML += `<option value="${city.name}" data-code="${city.code}">${city.name}</option>`;
            });
            
            citySelect.disabled = false;
        });

        // Handle City Change
        citySelect.addEventListener('change', async (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const code = selectedOption.dataset.code;

            brgySelect.innerHTML = '<option value="">Loading Barangays...</option>';
            brgySelect.disabled = true;

            if (code) {
                const res = await fetch(`${PSGC_BASE_URL}/cities-municipalities/${code}/barangays/`);
                const barangays = await res.json();

                brgySelect.innerHTML = '<option value="">Select Barangay</option>';
                barangays.sort((a, b) => a.name.localeCompare(b.name)).forEach(brgy => {
                    brgySelect.innerHTML += `<option value="${brgy.name}">${brgy.name}</option>`;
                });
                brgySelect.disabled = false;
            }
        });

    } catch (error) {
        console.error("Failed to load Philippine location data:", error);
        provSelect.innerHTML = '<option value="">Error loading locations</option>';
    }
});
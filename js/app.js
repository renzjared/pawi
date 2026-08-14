document.addEventListener('DOMContentLoaded', async () => {
    initMaps();
    window.currentUser = null; // Changed to global window object
    let isAdmin = false;

    // --- ROUTING & UI ---
    const routeLinks = document.querySelectorAll('.tab-link');
    const modules = document.querySelectorAll('.module');
    const navBtns = document.querySelectorAll('.tab-btn');

    function navigateTo(targetId) {
        // Enforce login for contributing
        if (targetId === 'add-view' && !window.currentUser) {
            document.getElementById('auth-modal').style.display = 'flex';
            return showToast("You must be logged in to contribute.");
        }

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
    }

    routeLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.target);
        });
    });

    // --- AUTHENTICATION & DASHBOARD ---
    const loginBtn = document.getElementById('nav-login-btn');
    const authModal = document.getElementById('auth-modal');

    async function handleAuthChange(session) {
        if (session) {
            window.currentUser = session.user; // Set to global
            loginBtn.textContent = "Dashboard";
            authModal.style.display = 'none';
            
            // Check Admin (Replace with your actual email!)
            isAdmin = window.currentUser.email === 'YOUR_ADMIN_EMAIL@gmail.com'; 
            
            if (isAdmin && !document.querySelector('[data-target="admin-view"]')) {
                const adminBtn = document.createElement('button');
                adminBtn.className = 'tab-btn tab-link';
                adminBtn.dataset.target = 'admin-view';
                adminBtn.textContent = 'Admin';
                adminBtn.onclick = (e) => { e.preventDefault(); navigateTo('admin-view'); };
                document.querySelector('.tabs').insertBefore(adminBtn, loginBtn);
            }

            // Load Dashboard Data
            const profile = await getUserProfile(window.currentUser.id);
            document.getElementById('dash-xp').textContent = profile?.xp || 0;
            
            const myLocs = allLocations.filter(loc => loc.user_id === window.currentUser.id);
            const list = document.getElementById('dash-contributions');
            list.innerHTML = myLocs.length ? myLocs.map(loc => `<div class="loc-card"><h4>${loc.name}</h4></div>`).join('') : '<p>No contributions yet.</p>';
        } else {
            window.currentUser = null;
            loginBtn.textContent = "Sign In";
        }
    }

    loginBtn.addEventListener('click', () => {
        if (!window.currentUser) authModal.style.display = 'flex';
        else navigateTo('dashboard-view');
    });

    document.getElementById('btn-google').addEventListener('click', async () => {
        await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname }});
    });
    
    document.getElementById('close-auth-btn').addEventListener('click', () => authModal.style.display = 'none');
    
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });

    supabaseClient.auth.getSession().then(({ data: { session } }) => handleAuthChange(session));
    supabaseClient.auth.onAuthStateChange((event, session) => handleAuthChange(session));


    // --- TOAST NOTIFICATIONS ---
    window.showToast = (msg) => {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { 
            toast.classList.remove('show'); 
            setTimeout(() => toast.remove(), 300); 
        }, 3000);
    };


    // --- MAP FILTERS & PLOTTING ---
    window.triggerPlotting = () => {
        const currentFilters = {
            access: document.getElementById('filter-access').value,
            type: document.getElementById('filter-type').value,
            setting: document.getElementById('filter-setting').value
        };
        plotLocations(allLocations, currentFilters);
    };

    document.querySelectorAll('.filter-trigger').forEach(select => select.addEventListener('change', window.triggerPlotting));


    // --- VOTING & COMMENTS ---
    window.handleVote = async (locId, value) => {
        if (!window.currentUser) return showToast("You must log in to vote.");
        
        const loc = allLocations.find(l => l.id === locId);
        if (!loc.votes) loc.votes = [];
        const userId = window.currentUser.id;
        
        let myVoteObj = loc.votes.find(v => v.user_id === userId);
        let currentVote = myVoteObj ? myVoteObj.vote_value : 0;
        
        const upBtn = document.getElementById(`upvote-${locId}`);
        const downBtn = document.getElementById(`downvote-${locId}`);
        const scoreSpan = document.getElementById(`score-${locId}`);
        let currentScore = parseInt(scoreSpan.textContent);
        
        try {
            if (currentVote === value) {
                // TOGGLE OFF
                await removeVote(locId, userId);
                loc.votes = loc.votes.filter(v => v.user_id !== userId);
                currentScore -= value;
                upBtn.classList.remove('active-up');
                downBtn.classList.remove('active-down');
            } else {
                // SWITCH or NEW VOTE
                await submitVote(locId, userId, value);
                if (myVoteObj) {
                    myVoteObj.vote_value = value;
                    currentScore += (value * 2);
                } else {
                    loc.votes.push({ user_id: userId, vote_value: value });
                    currentScore += value;
                }
                
                if (value === 1) {
                    upBtn.classList.add('active-up');
                    downBtn.classList.remove('active-down');
                } else {
                    upBtn.classList.remove('active-up');
                    downBtn.classList.add('active-down');
                }
            }
            scoreSpan.textContent = currentScore;
        } catch (e) {
            showToast("Error updating vote: " + e.message);
        }
    };

    window.handleComment = async (locId) => {
        const input = document.getElementById(`comment-input-${locId}`);
        const content = input.value.trim();
        if (!content) return;
        
        input.disabled = true;
        
        try {
            const newComment = await submitComment(locId, window.currentUser?.id || null, content);
            
            const loc = allLocations.find(l => l.id === locId);
            if (!loc.comments) loc.comments = [];
            loc.comments.push(newComment);
            
            const list = document.getElementById(`comments-list-${locId}`);
            const placeholder = list.querySelector('.no-comments');
            if (placeholder) placeholder.remove();
            
            const authorName = window.currentUser ? "You" : "Guest";
            const timeString = new Date(newComment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            const commentHtml = `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${authorName}</span>
                        <span>${timeString}</span>
                    </div>
                    <div>${newComment.content}</div>
                </div>
            `;
            
            list.insertAdjacentHTML('beforeend', commentHtml);
            list.scrollTop = list.scrollHeight;
            
            input.value = '';
            showToast("Comment posted!");
        } catch (e) {
            showToast("Error: " + e.message);
        } finally {
            input.disabled = false;
        }
    };


    // --- MAP SEARCHING ---
    document.getElementById('map-search-btn').addEventListener('click', () => {
        geocodeLocation(document.getElementById('map-search-input').value, fullMap);
    });
    document.getElementById('map-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') geocodeLocation(e.target.value, fullMap);
    });


    // --- IMAGE UPLOAD TOGGLER ---
    document.getElementById('loc-image-type').addEventListener('change', (e) => {
        document.getElementById('group-image-file').style.display = e.target.value === 'file' ? 'block' : 'none';
        document.getElementById('group-image-url').style.display = e.target.value === 'url' ? 'block' : 'none';
    });


    // --- ADD LOCATION FORM ---
    const form = document.getElementById('add-location-form');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!window.currentUser) {
            document.getElementById('auth-modal').style.display = 'flex';
            return showToast("You must be signed in to add a hydration spot.");
        }

        const coordsInput = document.getElementById('loc-coords');
        if (!coordsInput.dataset.lat) return showToast("Please tap the map to pinpoint the location first.");

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
            showToast('Awesome! Location added successfully.');
            form.reset();
            coordsInput.dataset.lat = ''; coordsInput.dataset.lng = '';
            
            document.querySelector('.tab-btn[data-target="map-view"]').click();
            allLocations = await fetchAllLocations();
            window.triggerPlotting();
            
            setTimeout(() => fullMap.setView([payload.lat, payload.lng], 16), 200);
            
        } catch (error) {
            console.error(error);
            showToast('Error: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Location';
        }
    });

    // --- PARTNERS SLIDESHOW & ADMIN ---
    async function loadPartners() {
        const partners = await fetchPartners();
        const container = document.getElementById('partners-slideshow-container');
        const adminList = document.getElementById('admin-partners-list');
        
        if (partners.length > 0) {
            container.innerHTML = partners.map(p => `<img src="${p.image_url}" alt="${p.name}" style="height: 80px; object-fit: contain; border-radius: 8px;">`).join('');
            if(adminList) adminList.innerHTML = partners.map(p => `<div class="loc-card"><h4>${p.name}</h4><p>${p.image_url}</p></div>`).join('');
        } else {
            container.innerHTML = '<p class="subtitle">Community partners coming soon!</p>';
        }
    }

    if (document.getElementById('add-partner-form')) {
        document.getElementById('add-partner-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await addPartner(document.getElementById('partner-name').value, document.getElementById('partner-url').value);
            document.getElementById('add-partner-form').reset();
            showToast('Partner added!');
            loadPartners();
        });
    }

    // --- INITIAL LOAD ---
    try {
        allLocations = await fetchAllLocations(); 
        window.triggerPlotting();
        loadPartners();
    } catch (error) { console.error('Failed initial load:', error); }
});
document.addEventListener('DOMContentLoaded', async () => {
    initMaps();
    let currentUser = null;
    let isAdmin = false;

    // --- ROUTING & UI ---
    const routeLinks = document.querySelectorAll('.tab-link');
    const modules = document.querySelectorAll('.module');
    const navBtns = document.querySelectorAll('.tab-btn');

    function navigateTo(targetId) {
        // Enforce login for contributing
        if (targetId === 'add-view' && !currentUser) {
            document.getElementById('auth-modal').style.display = 'flex';
            return alert("You must be logged in to contribute.");
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
            currentUser = session.user;
            window.currentUser = currentUser; // Make globally accessible
            loginBtn.textContent = "Dashboard";
            authModal.style.display = 'none';
            
            // Check Admin (Replace with your actual email)
            isAdmin = currentUser.email === 'YOUR_ADMIN_EMAIL@gmail.com'; 
            
            if (isAdmin && !document.querySelector('[data-target="admin-view"]')) {
                const adminBtn = document.createElement('button');
                adminBtn.className = 'tab-btn tab-link';
                adminBtn.dataset.target = 'admin-view';
                adminBtn.textContent = 'Admin';
                adminBtn.onclick = (e) => { e.preventDefault(); navigateTo('admin-view'); };
                document.querySelector('.tabs').insertBefore(adminBtn, loginBtn);
            }

            // Load Dashboard Data
            const profile = await getUserProfile(currentUser.id);
            document.getElementById('dash-xp').textContent = profile?.xp || 0;
            
            const myLocs = allLocations.filter(loc => loc.user_id === currentUser.id);
            const list = document.getElementById('dash-contributions');
            list.innerHTML = myLocs.length ? myLocs.map(loc => `<div class="loc-card"><h4>${loc.name}</h4></div>`).join('') : '<p>No contributions yet.</p>';
        } else {
            currentUser = null;
            loginBtn.textContent = "Sign In";
        }
    }

    loginBtn.addEventListener('click', () => {
        if (!currentUser) authModal.style.display = 'flex';
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

    // --- MAP INTERACTIONS (VOTING & COMMENTS) ---
    // Toast Notification System
    window.showToast = (msg) => {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10); // Slight delay for animation
        setTimeout(() => { 
            toast.classList.remove('show'); 
            setTimeout(() => toast.remove(), 300); 
        }, 3000);
    };

    window.handleVote = async (locId, value) => {
        if (!window.currentUser) return showToast("You must log in to vote.");
        
        // Find in-memory location & buttons
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
                // TOGGLE OFF: User clicked the same vote again
                await removeVote(locId, userId);
                loc.votes = loc.votes.filter(v => v.user_id !== userId); // Update memory
                currentScore -= value;
                upBtn.classList.remove('active-up');
                downBtn.classList.remove('active-down');
            } else {
                // SWITCH or NEW VOTE
                await submitVote(locId, userId, value);
                if (myVoteObj) {
                    myVoteObj.vote_value = value;
                    currentScore += (value * 2); // Going from -1 to 1 is a jump of 2
                } else {
                    loc.votes.push({ user_id: userId, vote_value: value });
                    currentScore += value;
                }
                
                // Update active classes
                if (value === 1) {
                    upBtn.classList.add('active-up');
                    downBtn.classList.remove('active-down');
                } else {
                    upBtn.classList.remove('active-up');
                    downBtn.classList.add('active-down');
                }
            }
            scoreSpan.textContent = currentScore; // Instantly update HTML
        } catch (e) {
            showToast("Error updating vote: " + e.message);
        }
    };

    window.handleComment = async (locId) => {
        const input = document.getElementById(`comment-input-${locId}`);
        const content = input.value.trim();
        if (!content) return;
        
        input.disabled = true; // Prevent double-clicking
        
        try {
            const newComment = await submitComment(locId, window.currentUser?.id || null, content);
            
            // Update memory
            const loc = allLocations.find(l => l.id === locId);
            if (!loc.comments) loc.comments = [];
            loc.comments.push(newComment);
            
            // Render to DOM directly
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
            list.scrollTop = list.scrollHeight; // Auto-scroll to the new comment
            
            input.value = '';
            showToast("Comment posted!");
        } catch (e) {
            showToast("Error: " + e.message);
        } finally {
            input.disabled = false;
        }
    };

    // --- PARTNERS SLIDESHOW & ADMIN ---
    async function loadPartners() {
        const partners = await fetchPartners();
        const container = document.getElementById('partners-slideshow-container');
        const adminList = document.getElementById('admin-partners-list');
        
        if (partners.length > 0) {
            container.innerHTML = partners.map(p => `<img src="${p.image_url}" alt="${p.name}" style="height: 80px; object-fit: contain; border-radius: 8px;">`).join('');
            adminList.innerHTML = partners.map(p => `<div class="loc-card"><h4>${p.name}</h4><p>${p.image_url}</p></div>`).join('');
        } else {
            container.innerHTML = '<p class="subtitle">Community partners coming soon!</p>';
        }
    }

    document.getElementById('add-partner-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addPartner(document.getElementById('partner-name').value, document.getElementById('partner-url').value);
        document.getElementById('add-partner-form').reset();
        alert('Partner added!');
        loadPartners();
    });

    // --- INITIAL LOAD ---
    try {
        allLocations = await fetchAllLocations(); 
        window.triggerPlotting();
        loadPartners();
    } catch (error) { console.error(error); }
});
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Locations
async function saveLocationToDB(data) {
    const pointStr = `POINT(${data.lng} ${data.lat})`;
    const { data: { session } } = await supabaseClient.auth.getSession();

    const { error } = await supabaseClient.from('water_locations').insert([{
        name: data.name, type: data.type, access: data.access,
        indoor_outdoor: data.setting, address_line1: data.line1, address_line2: data.line2,
        province: data.province, city: data.city, barangay: data.barangay,
        notes: data.notes, image_url: data.imageUrl, coords: pointStr,
        user_id: session?.user?.id
    }]);

    if (error) throw error;
    if (session) await awardXP(session.user.id, 50); // 50 XP for a new spot
}

async function fetchAllLocations() {
    // We fetch locations, plus the sum of votes
    const { data, error } = await supabaseClient
        .from('water_locations')
        .select(`
            *, lat, lng,
            votes ( vote_value ),
            comments ( id, content, created_at, user_id )
        `);
    if (error) throw error;
    return data;
}

// Gamification & Profiles
async function getUserProfile(userId) {
    // maybeSingle() prevents crashes if the row is missing
    const { data, error } = await supabaseClient.from('user_profiles').select('*').eq('id', userId).maybeSingle();
    
    // Auto-Heal: If the profile is missing (happens for older accounts), create it now
    if (!data) {
        await supabaseClient.from('user_profiles').upsert([{ id: userId, xp: 0 }]);
        return { xp: 0 };
    }
    return data;
}

async function awardXP(userId, amount) {
    const profile = await getUserProfile(userId);
    const newXp = (profile.xp || 0) + amount;
    // upsert ensures we update it securely
    await supabaseClient.from('user_profiles').upsert({ id: userId, xp: newXp });
}

// Interactions (Votes & Comments)
async function submitVote(locationId, userId, voteValue) {
    const { error } = await supabaseClient.from('votes').upsert(
        { location_id: locationId, user_id: userId, vote_value: voteValue },
        { onConflict: 'location_id, user_id' }
    );
    if (error) throw error;
}

async function submitComment(locationId, userId, content) {
    const { error } = await supabaseClient.from('comments').insert([
        { location_id: locationId, user_id: userId, content: content }
    ]);
    if (error) throw error;
    if (userId) await awardXP(userId, 10); // 10 XP for commenting
}

// Partners (Admin)
async function fetchPartners() {
    const { data } = await supabaseClient.from('partners').select('*').eq('is_active', true);
    return data || [];
}

async function addPartner(name, url) {
    const { error } = await supabaseClient.from('partners').insert([{ name, image_url: url }]);
    if (error) throw error;
}
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

async function saveLocationToDB(data) {
    const pointStr = `POINT(${data.lng} ${data.lat})`;

    const { error } = await supabaseClient.from('water_locations').insert([
        {
            name: data.name,
            type: data.type,
            access: data.access,
            indoor_outdoor: data.setting,
            address_line1: data.line1,
            address_line2: data.line2,
            province: data.province,
            city: data.city,
            barangay: data.barangay,
            notes: data.notes,
            image_url: data.imageUrl,
            coords: pointStr
        }
    ]);

    if (error) throw error;
}

async function fetchAllLocations() {
    const { data, error } = await supabaseClient
        .from('water_locations')
        .select(`
            id, name, type, access, indoor_outdoor, 
            address_line1, address_line2, province, city, barangay,
            notes, image_url,
            lat:st_y(coords::geometry), 
            lng:st_x(coords::geometry)
        `);

    if (error) throw error;
    return data;
}
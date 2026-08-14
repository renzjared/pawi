const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

async function saveLocationToDB(data) {
    // PostGIS requires geography to be formatted as POINT(longitude latitude)
    const pointStr = `POINT(${data.lng} ${data.lat})`;

    const { error } = await supabase.from('water_locations').insert([
        {
            name: data.name,
            type: data.type,
            access: data.access,
            indoor_outdoor: data.setting,
            building: data.building,
            floor: data.floor,
            street: data.street,
            notes: data.notes,
            image_url: data.imageUrl,
            coords: pointStr
        }
    ]);

    if (error) throw error;
}

async function fetchAllLocations() {
    // Using ST_Y and ST_X to convert PostGIS POINT back to readable lat/lng
    const { data, error } = await supabase
        .select(`
            id, name, type, access, indoor_outdoor, building, floor, street, notes, image_url,
            lat:st_y(coords::geometry), 
            lng:st_x(coords::geometry)
        `)
        .from('water_locations');

    if (error) throw error;
    return data;
}
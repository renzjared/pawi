async function uploadToImgur(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
            'Authorization': `Client-ID ${CONFIG.IMGUR_CLIENT_ID}`
        },
        body: formData
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.data.error || 'Failed to upload image to Imgur');
    }
    
    return data.data.link; // Returns the direct image URL
}
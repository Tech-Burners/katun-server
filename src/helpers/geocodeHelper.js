const axios = require('axios');

const getCoordinatesFromAddress = async (address) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; 
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const location = response.data.results[0].geometry.location;
    return location; 
  } catch (error) {
    console.error('Error fetching coordinates:', error.message);
    throw error;
  }
};

module.exports = getCoordinatesFromAddress;

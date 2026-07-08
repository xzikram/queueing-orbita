const axios = require('axios');

async function main() {
  try {
    const res = await axios.get('http://localhost:3001/api/schedules/active-today');
    console.log('Status:', res.status);
    console.log('Data count:', res.data.length);
    console.log('Data:', res.data);
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Data:', err.response.data);
    }
  }
}

main();

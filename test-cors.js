const https = require('https');
https.get('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap', (res) => {
  console.log('Headers:', res.headers['access-control-allow-origin']);
});

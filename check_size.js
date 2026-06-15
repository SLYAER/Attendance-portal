const fs = require('fs');
['icon-192.png', 'icon-512.png', 'maskable-icon-512.png'].forEach(file => {
  try {
    const stat = fs.statSync(`public/icons/${file}`);
    console.log(`${file}: ${stat.size} bytes`);
  } catch (e) {
    console.log(`${file}: Not found`);
  }
});

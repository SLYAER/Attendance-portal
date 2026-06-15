import fs from 'fs/promises';

async function download(url, path) {
  try {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    await fs.writeFile(path, Buffer.from(buffer));
    console.log('Downloaded', path, 'Size:', buffer.byteLength);
  } catch(e) {
    console.error('Failed to download', path, e);
  }
}

async function run() {
  await download('https://placehold.co/192x192/000000/FFFFFF/png?text=192', 'public/icons/icon-192.png');
  await download('https://placehold.co/512x512/000000/FFFFFF/png?text=512', 'public/icons/icon-512.png');
  await download('https://placehold.co/512x512/000000/FFFFFF/png?text=Maskable', 'public/icons/maskable-icon-512.png');
  await download('https://placehold.co/192x192/000000/FFFFFF/png?text=Shortcut', 'public/icons/shortcut-icon.png');
}

run();

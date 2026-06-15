import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

async function createIcon(fileName, size) {
  const filePath = path.join(process.cwd(), 'public', 'icons', fileName);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 }
    }
  })
  .png()
  .toFile(filePath);
  console.log(`Generated ${fileName} at ${size}x${size}`);
}

async function main() {
  try {
    const dir = path.join(process.cwd(), 'public', 'icons');
    await fs.mkdir(dir, { recursive: true });

    await createIcon('icon-192.png', 192);
    await createIcon('icon-512.png', 512);
    await createIcon('maskable-icon-512.png', 512);
    await createIcon('shortcut-icon.png', 192);
    
    console.log('All icons generated successfully!');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

main();

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function run() {
  const whiteSvg = fs.readFileSync(path.resolve('public/icon.svg'));
  const redSvg = fs.readFileSync(path.resolve('public/icon-red.svg'));

  console.log('Generating White Icon PNGs (Default)...');
  await sharp(whiteSvg)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('public/icon-512.png'));

  await sharp(whiteSvg)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('public/icon-192.png'));

  await sharp(whiteSvg)
    .resize(64, 64)
    .png()
    .toFile(path.resolve('public/favicon.png'));

  console.log('Generating Red Icon PNGs (Vibrant Option)...');
  await sharp(redSvg)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('public/icon-red-512.png'));

  await sharp(redSvg)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('public/icon-red-192.png'));

  console.log('Icon generation completed successfully!');
}

run().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

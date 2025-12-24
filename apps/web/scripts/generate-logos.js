const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '../public');

// Logo SVG definitions
const logoSvg = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 4H12C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H6V4Z" stroke="#6366f1" stroke-width="2.5" stroke-linejoin="round"/>
  <line x1="10" y1="9" x2="15" y2="9" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
  <line x1="10" y1="12" x2="16" y2="12" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
  <line x1="10" y1="15" x2="14" y2="15" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const logoWhiteSvg = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 4H12C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H6V4Z" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
  <line x1="10" y1="9" x2="15" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="10" y1="12" x2="16" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="10" y1="15" x2="14" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// Logo with gradient background (for app icons/favicons)
const logoWithBgSvg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  <g transform="translate(${size * 0.25}, ${size * 0.25}) scale(${size / 48})">
    <path d="M6 4H12C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H6V4Z" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="10" y1="9" x2="15" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="10" y1="12" x2="16" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="10" y1="15" x2="14" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`;

// Maskable icon (with safe zone padding for Android)
const logoMaskableSvg = (size) => {
  const padding = size * 0.1; // 10% padding for safe zone
  const innerSize = size - (padding * 2);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g transform="translate(${padding + innerSize * 0.25}, ${padding + innerSize * 0.25}) scale(${innerSize / 48})">
    <path d="M6 4H12C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H6V4Z" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
    <line x1="10" y1="9" x2="15" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="10" y1="12" x2="16" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="10" y1="15" x2="14" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`;
};

async function generateLogos() {
  console.log('Generating favicon and logo assets...\n');

  // ============================================
  // FAVICONS (Best Practices)
  // ============================================

  // favicon-16x16.png - Browser tabs
  await sharp(Buffer.from(logoWithBgSvg(16)))
    .png()
    .toFile(path.join(outputDir, 'favicon-16x16.png'));
  console.log('✓ favicon-16x16.png');

  // favicon-32x32.png - Browser tabs (Retina)
  await sharp(Buffer.from(logoWithBgSvg(32)))
    .png()
    .toFile(path.join(outputDir, 'favicon-32x32.png'));
  console.log('✓ favicon-32x32.png');

  // favicon.ico - Legacy support (we'll create a 32x32 PNG and rename)
  // Note: For true multi-size ICO, you'd need a different tool
  // Most modern browsers use PNG favicons
  await sharp(Buffer.from(logoWithBgSvg(32)))
    .png()
    .toFile(path.join(outputDir, 'favicon.ico'));
  console.log('✓ favicon.ico (32x32 fallback)');

  // ============================================
  // APPLE TOUCH ICONS
  // ============================================

  // apple-touch-icon.png - iOS home screen (180x180 is standard)
  await sharp(Buffer.from(logoWithBgSvg(180)))
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png (180x180)');

  // apple-touch-icon-precomposed.png - Legacy iOS
  await sharp(Buffer.from(logoWithBgSvg(180)))
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon-precomposed.png'));
  console.log('✓ apple-touch-icon-precomposed.png (180x180)');

  // ============================================
  // ANDROID / PWA ICONS
  // ============================================

  // android-chrome-192x192.png - Android home screen
  await sharp(Buffer.from(logoWithBgSvg(192)))
    .png()
    .toFile(path.join(outputDir, 'android-chrome-192x192.png'));
  console.log('✓ android-chrome-192x192.png');

  // android-chrome-512x512.png - Android splash screen
  await sharp(Buffer.from(logoWithBgSvg(512)))
    .png()
    .toFile(path.join(outputDir, 'android-chrome-512x512.png'));
  console.log('✓ android-chrome-512x512.png');

  // Maskable icons for Android (with safe zone)
  await sharp(Buffer.from(logoMaskableSvg(192)))
    .png()
    .toFile(path.join(outputDir, 'android-chrome-maskable-192x192.png'));
  console.log('✓ android-chrome-maskable-192x192.png');

  await sharp(Buffer.from(logoMaskableSvg(512)))
    .png()
    .toFile(path.join(outputDir, 'android-chrome-maskable-512x512.png'));
  console.log('✓ android-chrome-maskable-512x512.png');

  // ============================================
  // MICROSOFT / WINDOWS
  // ============================================

  // mstile-150x150.png - Windows tiles
  await sharp(Buffer.from(logoWithBgSvg(150)))
    .png()
    .toFile(path.join(outputDir, 'mstile-150x150.png'));
  console.log('✓ mstile-150x150.png');

  // ============================================
  // SAFARI PINNED TAB (SVG)
  // ============================================

  // Safari pinned tab - monochrome SVG
  const safariSvg = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 4H12C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H6V4Z" fill="black"/>
  <line x1="10" y1="9" x2="15" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="10" y1="12" x2="16" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <line x1="10" y1="15" x2="14" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;
  fs.writeFileSync(path.join(outputDir, 'safari-pinned-tab.svg'), safariSvg);
  console.log('✓ safari-pinned-tab.svg');

  // ============================================
  // OPEN GRAPH / SOCIAL MEDIA
  // ============================================

  // og-image.png - Social media preview (1200x630 is recommended)
  const ogSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ogBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1e1b4b"/>
        <stop offset="100%" style="stop-color:#312e81"/>
      </linearGradient>
      <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#6366f1"/>
        <stop offset="100%" style="stop-color:#a855f7"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#ogBg)"/>

    <!-- Logo icon -->
    <rect x="450" y="150" width="100" height="100" rx="20" fill="url(#logoBg)"/>
    <g transform="translate(462, 162) scale(3.2)">
      <path d="M6 4H12C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20H6V4Z" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="10" y1="9" x2="15" y2="9" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="12" x2="16" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="15" x2="14" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </g>

    <!-- Text -->
    <text x="570" y="215" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="bold" fill="white">DBView</text>
    <text x="600" y="350" font-family="system-ui, -apple-system, sans-serif" font-size="32" fill="#a5b4fc" text-anchor="middle">The Modern Database Client</text>
    <text x="600" y="400" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#818cf8" text-anchor="middle">for VS Code and Desktop</text>

    <!-- Beta badge -->
    <rect x="720" y="180" width="60" height="28" rx="14" fill="#6366f1" fill-opacity="0.3"/>
    <text x="750" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#a5b4fc" text-anchor="middle">Beta</text>
  </svg>`;

  await sharp(Buffer.from(ogSvg))
    .png()
    .toFile(path.join(outputDir, 'og-image.png'));
  console.log('✓ og-image.png (1200x630)');

  // Twitter card (same dimensions work well)
  await sharp(Buffer.from(ogSvg))
    .png()
    .toFile(path.join(outputDir, 'twitter-image.png'));
  console.log('✓ twitter-image.png (1200x630)');

  // ============================================
  // GENERAL PURPOSE LOGOS
  // ============================================

  const sizes = {
    medium: 128,
    large: 512,
  };

  for (const [sizeName, size] of Object.entries(sizes)) {
    // Transparent background - indigo color
    await sharp(Buffer.from(logoSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `logo-${sizeName}.png`));
    console.log(`✓ logo-${sizeName}.png (${size}x${size})`);

    // Transparent background - white color
    await sharp(Buffer.from(logoWhiteSvg))
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `logo-white-${sizeName}.png`));
    console.log(`✓ logo-white-${sizeName}.png (${size}x${size})`);

    // With gradient background (app icon style)
    await sharp(Buffer.from(logoWithBgSvg(size)))
      .png()
      .toFile(path.join(outputDir, `logo-bg-${sizeName}.png`));
    console.log(`✓ logo-bg-${sizeName}.png (${size}x${size})`);
  }

  console.log('\n✅ All favicon and logo assets generated!');
  console.log('📁 Output directory:', outputDir);
}

generateLogos().catch(console.error);

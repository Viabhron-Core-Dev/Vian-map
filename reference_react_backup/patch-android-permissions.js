import fs from 'fs';
import path from 'path';

const manifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (fs.existsSync(manifestPath)) {
  let content = fs.readFileSync(manifestPath, 'utf8');

  const permissions = [
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-feature android:name="android.hardware.location.gps" />'
  ];

  let modified = false;
  permissions.forEach(p => {
    if (!content.includes(p)) {
      content = content.replace('</manifest>', `    ${p}\n</manifest>`);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(manifestPath, content);
    console.log('✅ AndroidManifest.xml patched with location permissions.');
  } else {
    console.log('ℹ️ AndroidManifest.xml already has location permissions.');
  }
} else {
  console.log('❌ AndroidManifest.xml not found at ' + manifestPath);
}

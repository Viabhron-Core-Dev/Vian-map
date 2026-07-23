import fs from 'fs';
import path from 'path';

const rootBuildGradle = path.join(process.cwd(), 'android', 'build.gradle');
const appBuildGradle = path.join(process.cwd(), 'android', 'app', 'build.gradle');
const variablesGradle = path.join(process.cwd(), 'android', 'variables.gradle');
const gradleWrapperProperties = path.join(process.cwd(), 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');

/**
 * Robustly patches a Gradle or properties file by replacing patterns.
 */
function patchFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.log(`ℹ️ File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const { pattern, replacement } of replacements) {
        content = content.replace(pattern, replacement);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Patched ${path.relative(process.cwd(), filePath)}`);
    } else {
        console.log(`ℹ️ No changes needed for ${path.relative(process.cwd(), filePath)}`);
    }
}

// 1. Patch variables.gradle (Source of truth for versions in Capacitor)
// Using AGP 8.5.2 and Kotlin 1.9.24 for Java 21 compatibility
patchFile(variablesGradle, [
    { pattern: /minSdkVersion\s*=?\s*\d+/g, replacement: 'minSdkVersion = 22' },
    { pattern: /compileSdkVersion\s*=?\s*\d+/g, replacement: 'compileSdkVersion = 34' },
    { pattern: /targetSdkVersion\s*=?\s*\d+/g, replacement: 'targetSdkVersion = 34' },
    // Also support newer names
    { pattern: /minSdk\s*=?\s*\d+/g, replacement: 'minSdk = 22' },
    { pattern: /compileSdk\s*=?\s*\d+/g, replacement: 'compileSdk = 34' },
    { pattern: /targetSdk\s*=?\s*\d+/g, replacement: 'targetSdk = 34' },
    { pattern: /kotlin_version\s*=?\s*['"][\d.]+['"]/g, replacement: "kotlin_version = '1.9.24'" }
]);

// 2. Patch root build.gradle
patchFile(rootBuildGradle, [
    // Support both old 'classpath' and new 'plugins' style
    { pattern: /com\.android\.tools\.build:gradle:\d+\.\d+\.\d+/g, replacement: 'com.android.tools.build:gradle:8.5.2' },
    { pattern: /id\s*['"]com\.android\.application['"]\s*version\s*['"][\d.]+['"]/g, replacement: "id 'com.android.application' version '8.5.2'" },
    { pattern: /id\s*['"]com\.android\.library['"]\s*version\s*['"][\d.]+['"]/g, replacement: "id 'com.android.library' version '8.5.2'" },
    { pattern: /id\s*['"]org\.jetbrains\.kotlin\.android['"]\s*version\s*['"][\d.]+['"]/g, replacement: "id 'org.jetbrains.kotlin.android' version '1.9.24'" },
    { pattern: /ext\.kotlin_version\s*=\s*['"][\d.]+['"]/g, replacement: "ext.kotlin_version = '1.9.24'" }
]);

// 3. Patch app build.gradle
patchFile(appBuildGradle, [
    // Ensure Java 21 compatibility
    { pattern: /sourceCompatibility\s*=?\s*JavaVersion\.VERSION_\d+/g, replacement: 'sourceCompatibility = JavaVersion.VERSION_21' },
    { pattern: /targetCompatibility\s*=?\s*JavaVersion\.VERSION_\d+/g, replacement: 'targetCompatibility = JavaVersion.VERSION_21' },
    { pattern: /jvmTarget\s*=?\s*['"][\d.]+['"]/g, replacement: "jvmTarget = '21'" },
    // Handle hardcoded versions just in case variables.gradle is bypassed
    { pattern: /minSdkVersion\s+\d+/g, replacement: 'minSdkVersion 22' },
    { pattern: /compileSdkVersion\s+\d+/g, replacement: 'compileSdkVersion 34' },
    { pattern: /targetSdkVersion\s+\d+/g, replacement: 'targetSdkVersion 34' },
    { pattern: /minSdk\s+\d+/g, replacement: 'minSdk 22' },
    { pattern: /compileSdk\s+\d+/g, replacement: 'compileSdk 34' },
    { pattern: /targetSdk\s+\d+/g, replacement: 'targetSdk 34' }
]);

// 4. Patch gradle-wrapper.properties
patchFile(gradleWrapperProperties, [
    // Support more patterns for gradle wrapper
    { pattern: /gradle-\d+\.\d+(\.\d+)?-(all|bin)\.zip/, replacement: 'gradle-8.9-all.zip' }
]);

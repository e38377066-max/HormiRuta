import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const versionFile = path.join(root, 'version.json');
const version = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

version.versionCode += 1;
const parts = version.versionName.split('.');
parts[2] = String(Number(parts[2]) + 1);
version.versionName = parts.join('.');

fs.writeFileSync(versionFile, JSON.stringify(version, null, 2) + '\n');

const androidGradle = path.join(root, 'android/app/build.gradle');
let gradle = fs.readFileSync(androidGradle, 'utf8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${version.versionCode}`);
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${version.versionName}"`);
fs.writeFileSync(androidGradle, gradle);

const iosProject = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
if (fs.existsSync(iosProject)) {
  let pbx = fs.readFileSync(iosProject, 'utf8');
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${version.versionCode};`);
  pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version.versionName};`);
  fs.writeFileSync(iosProject, pbx);
}

console.log(`Version bumped to ${version.versionName} (code: ${version.versionCode})`);

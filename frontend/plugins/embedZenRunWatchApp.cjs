/**
 * Copies watch-app sources into ios/ and adds WatchKit 2 app + extension targets via node-xcode.
 * Idempotent: skips if a watchOS app target is already present.
 */

const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const EXT_NAME = 'ZenRunWatch WatchKit Extension';
const APP_NAME = 'ZenRunWatch';

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  rmrf(dest);
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function findPbxproj(iosRoot) {
  const entries = fs.readdirSync(iosRoot);
  const proj = entries.find((e) => e.endsWith('.xcodeproj'));
  if (!proj) throw new Error('No .xcodeproj in ios folder');
  return path.join(iosRoot, proj, 'project.pbxproj');
}

function ensureAppIcon(iosRoot, projectRoot) {
  const iconSrc = path.join(projectRoot, 'assets', 'icon.png');
  const appIconDir = path.join(iosRoot, APP_NAME, 'Assets.xcassets', 'AppIcon.appiconset');
  if (!fs.existsSync(iconSrc)) return;
  fs.mkdirSync(appIconDir, { recursive: true });
  fs.copyFileSync(iconSrc, path.join(appIconDir, 'AppIcon.png'));
  fs.writeFileSync(
    path.join(appIconDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          {
            filename: 'AppIcon.png',
            idiom: 'universal',
            platform: 'watchos',
            size: '1024x1024',
          },
        ],
        info: { version: 1, author: 'xcode' },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(iosRoot, APP_NAME, 'Assets.xcassets', 'Contents.json'),
    JSON.stringify({ info: { version: 1, author: 'xcode' } }, null, 2),
  );
}

function watchTargetsAlreadyPresent(proj) {
  const section = proj.pbxNativeTargetSection();
  for (const key of Object.keys(section)) {
    if (key.endsWith('_comment')) continue;
    const t = section[key];
    const pt = t && t.productType ? String(t.productType).replace(/"/g, '') : '';
    if (pt === 'com.apple.product-type.application.watchapp2') return true;
  }
  return false;
}

/** node-xcode bug: pbxCreateGroup sets isa to quoted string; CocoaPods cannot parse it. */
function sanitizePbxprojText(body) {
  let out = body;
  out = out.replace(/isa = "PBXGroup";/g, 'isa = PBXGroup;');
  out = out.replace(
    /INFOPLIST_FILE = "ZenRunWatch WatchKit Extension\/ZenRunWatch WatchKit Extension-Info\.plist";/g,
    'INFOPLIST_FILE = "ZenRunWatch WatchKit Extension/Info.plist";',
  );
  out = out.replace(
    /INFOPLIST_FILE = "ZenRunWatch\/ZenRunWatch-Info\.plist";/g,
    'INFOPLIST_FILE = "ZenRunWatch/Info.plist";',
  );
  return out;
}

/**
 * @param {string} projectRoot — Expo project root (…/frontend)
 * @param {string} iosRoot — …/frontend/ios
 */
function embedZenRunWatchApp(projectRoot, iosRoot) {
  const watchRoot = path.join(projectRoot, '..', 'watch-app');
  if (!fs.existsSync(watchRoot)) {
    console.warn('[withWatchApp] watch-app folder not found at', watchRoot);
    return;
  }

  const extSrc = path.join(watchRoot, 'Extension');
  const appSrc = path.join(watchRoot, 'ZenRunWatch');
  const extDest = path.join(iosRoot, EXT_NAME);
  const appDest = path.join(iosRoot, APP_NAME);

  copyRecursive(extSrc, extDest);
  copyRecursive(appSrc, appDest);
  ensureAppIcon(iosRoot, projectRoot);

  const pbxPath = findPbxproj(iosRoot);
  const proj = xcode.project(pbxPath);
  proj.parseSync();

  if (watchTargetsAlreadyPresent(proj)) {
    fs.writeFileSync(pbxPath, sanitizePbxprojText(proj.writeSync()));
    return;
  }

  proj.addTarget(APP_NAME, 'watch2_app', APP_NAME, 'com.phaedrus75.runzen.watchkitapp');
  const extRet = proj.addTarget(EXT_NAME, 'watch2_extension', EXT_NAME, 'com.phaedrus75.runzen.watchkitapp.watchkitextension');
  const extKey = extRet && extRet.uuid;
  if (!extKey) {
    throw new Error('[withWatchApp] addTarget(watch2_extension) did not return a uuid — aborting to avoid corrupting the iOS target.');
  }

  proj.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', extKey);
  proj.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', extKey);
  proj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', extKey);

  proj.addFramework('System/Library/Frameworks/WatchConnectivity.framework', {
    target: extKey,
    customFramework: false,
  });

  const zenGroupKey = proj.findPBXGroupKey({ name: 'ZenRun' });
  if (!zenGroupKey) {
    throw new Error('[withWatchApp] Could not find PBX group "ZenRun".');
  }

  const swiftFiles = fs.readdirSync(extDest).filter((f) => f.endsWith('.swift'));
  for (const f of swiftFiles) {
    const rel = `${EXT_NAME}/${f}`;
    proj.addSourceFile(rel, { target: extKey }, zenGroupKey);
  }

  const plistExt = `"${EXT_NAME}/Info.plist"`;
  const plistApp = `"${APP_NAME}/Info.plist"`;
  proj.updateBuildProperty('INFOPLIST_FILE', plistExt, undefined, EXT_NAME);
  proj.updateBuildProperty('INFOPLIST_FILE', plistApp, undefined, APP_NAME);
  proj.updateBuildProperty('SDKROOT', 'watchos', undefined, EXT_NAME);
  proj.updateBuildProperty('SDKROOT', 'watchos', undefined, APP_NAME);
  proj.updateBuildProperty('WATCHOS_DEPLOYMENT_TARGET', '10.0', undefined, EXT_NAME);
  proj.updateBuildProperty('WATCHOS_DEPLOYMENT_TARGET', '10.0', undefined, APP_NAME);
  proj.updateBuildProperty('TARGETED_DEVICE_FAMILY', '4', undefined, EXT_NAME);
  proj.updateBuildProperty('TARGETED_DEVICE_FAMILY', '4', undefined, APP_NAME);
  proj.updateBuildProperty('SKIP_INSTALL', 'YES', undefined, EXT_NAME);
  proj.updateBuildProperty('SKIP_INSTALL', 'YES', undefined, APP_NAME);
  proj.updateBuildProperty('SWIFT_VERSION', '5.0', undefined, EXT_NAME);
  proj.updateBuildProperty('SWIFT_VERSION', '5.0', undefined, APP_NAME);
  proj.updateBuildProperty('CODE_SIGN_STYLE', 'Automatic', undefined, EXT_NAME);
  proj.updateBuildProperty('CODE_SIGN_STYLE', 'Automatic', undefined, APP_NAME);

  proj.updateBuildProperty('WK_WATCHKIT_APP', 'YES', undefined, 'ZenRun');

  fs.writeFileSync(pbxPath, sanitizePbxprojText(proj.writeSync()));
}

module.exports = { embedZenRunWatchApp, default: embedZenRunWatchApp };

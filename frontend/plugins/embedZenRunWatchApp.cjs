/**
 * Copies watch-app sources into ios/ and adds WatchKit 2 app + extension targets via node-xcode.
 * Idempotent: skips if a watchOS app target is already present.
 */

const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const EXT_NAME = 'ZenRunWatch WatchKit Extension';
const APP_NAME = 'ZenRunWatch';
/** PBXNativeTarget _comment values include quotes; pbxTargetByName matches these exactly. */
const EXT_NATIVE_TARGET_COMMENT = '"ZenRunWatch WatchKit Extension"';
const APP_NATIVE_TARGET_COMMENT = '"ZenRunWatch"';
/** Values of `name` on PBXNativeTarget as stored by node-xcode / parser (includes embedded quotes). */
const APP_TARGET_FIND_KEY = '"ZenRunWatch"';
const EXT_TARGET_FIND_KEY = '"ZenRunWatch WatchKit Extension"';

/**
 * Expo's template pbxproj often has no PBXTargetDependency / PBXContainerItemProxy sections.
 * node-xcode's addTargetDependency skips work when those sections are missing, so Watch never
 * builds before the iOS "Embed Watch Content" phase (archive fails: Release-watchos/ZenRunWatch.app missing).
 */
function ensurePbxDependencySections(proj) {
  const objs = proj.hash.project.objects;
  if (!objs.PBXTargetDependency) objs.PBXTargetDependency = {};
  if (!objs.PBXContainerItemProxy) objs.PBXContainerItemProxy = {};
}

function nativeTargetDependsOn(proj, fromUuid, toUuid) {
  const nt = proj.pbxNativeTargetSection();
  const from = nt[fromUuid];
  if (!from || !Array.isArray(from.dependencies)) return false;
  const depSection = proj.hash.project.objects.PBXTargetDependency;
  if (!depSection) return false;
  for (const ref of from.dependencies) {
    const row = depSection[ref.value];
    if (row && String(row.target).replace(/"/g, '') === String(toUuid).replace(/"/g, '')) return true;
  }
  return false;
}

/**
 * Without DEVELOPMENT_TEAM on Watch targets Xcode 14+ archives fail with
 * `Signing for "X" requires a development team`. EAS provisions credentials for these
 * bundle IDs via `extra.eas.build.experimental.ios.appExtensions`, but Xcode still needs
 * the team set on the target. Idempotent: the property setter is a no-op when unchanged.
 */
function ensureWatchTargetDevelopmentTeam(proj, appleTeamId) {
  if (!appleTeamId) return;
  proj.updateBuildProperty('DEVELOPMENT_TEAM', appleTeamId, undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('DEVELOPMENT_TEAM', appleTeamId, undefined, APP_NATIVE_TARGET_COMMENT);
}

/** ZenRun → ZenRunWatch → WatchKit Extension so archive builds watch products before embed. */
function ensureWatchTargetDependencies(proj) {
  ensurePbxDependencySections(proj);
  const mainUuid = proj.getFirstTarget().uuid;
  const watchUuid = proj.findTargetKey(APP_TARGET_FIND_KEY);
  const extUuid = proj.findTargetKey(EXT_TARGET_FIND_KEY);
  if (!watchUuid || !extUuid) return;

  if (!nativeTargetDependsOn(proj, mainUuid, watchUuid)) {
    proj.addTargetDependency(mainUuid, [watchUuid]);
  }
  if (!nativeTargetDependsOn(proj, watchUuid, extUuid)) {
    proj.addTargetDependency(watchUuid, [extUuid]);
  }
}

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

/**
 * Apple requires the Watch app + extension Info.plists to share CFBundleShortVersionString and
 * CFBundleVersion with the companion iOS app. Validation otherwise fails with:
 *   "The value of CFBundleShortVersionString in your WatchKit app's Info.plist (X) does not match
 *    the value in your companion app's Info.plist (Y)."
 * Idempotent: regex covers any current value, including ours after a prior run.
 */
function syncWatchAppVersion(plistPaths, version, buildNumber) {
  const escape = (v) => String(v).replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  for (const plistPath of plistPaths) {
    if (!fs.existsSync(plistPath)) continue;
    let body = fs.readFileSync(plistPath, 'utf8');
    if (version) {
      body = body.replace(
        /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${escape(version)}$2`,
      );
    }
    if (buildNumber) {
      body = body.replace(
        /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${escape(buildNumber)}$2`,
      );
    }
    fs.writeFileSync(plistPath, body);
  }
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

/**
 * node-xcode addTarget leaves Watch targets inheriting iOS (TARGETED_DEVICE_FAMILY 1,2) with no SDKROOT,
 * so Xcode builds them for iphoneos and fails on watchkit2-extension / watchapp2 product types.
 * Inject watchOS settings on every XCBuildConfiguration that uses our Watch bundle IDs.
 */
function patchWatchOSInPbxproj(body) {
  const tab = '\t\t\t\t';
  const watchSdkBlock = `${tab}SDKROOT = watchos;
${tab}SUPPORTED_PLATFORMS = "watchos watchsimulator";
${tab}WATCHOS_DEPLOYMENT_TARGET = 10.0;
${tab}SWIFT_VERSION = 5.0;
`;

  function injectBeforeTargeted(match, bundleLine, middle, tfPrefix) {
    // node-xcode updateBuildProperty may already add SDKROOT/SWIFT; we must still fix TARGETED_DEVICE_FAMILY.
    if (middle.includes('SDKROOT = watchos')) {
      const platforms =
        middle.includes('SUPPORTED_PLATFORMS') ? '' : `${tab}SUPPORTED_PLATFORMS = "watchos watchsimulator";\n`;
      return `${bundleLine}${middle}${platforms}${tfPrefix}4;`;
    }
    return `${bundleLine}${middle}${watchSdkBlock}${tfPrefix}4;`;
  }

  let out = body;
  // WatchKit extension
  out = out.replace(
    /(PRODUCT_BUNDLE_IDENTIFIER = "com\.phaedrus75\.runzen\.watchkitapp\.watchkitextension";)([\s\S]*?)(\t\t\t\tTARGETED_DEVICE_FAMILY = )"1,2";/g,
    injectBeforeTargeted,
  );
  // Watch app container
  out = out.replace(
    /(PRODUCT_BUNDLE_IDENTIFIER = "com\.phaedrus75\.runzen\.watchkitapp";)([\s\S]*?)(\t\t\t\tTARGETED_DEVICE_FAMILY = )"1,2";/g,
    injectBeforeTargeted,
  );
  // If a prior run already set TARGETED_DEVICE_FAMILY = 4 but forgot SDKROOT
  out = out.replace(
    /(PRODUCT_BUNDLE_IDENTIFIER = "com\.phaedrus75\.runzen\.watchkitapp\.watchkitextension";)([\s\S]*?)(\t\t\t\tTARGETED_DEVICE_FAMILY = )4;/g,
    (m, bundleLine, middle, tfPrefix) => {
      if (middle.includes('SDKROOT = watchos')) return m;
      return `${bundleLine}${middle}${watchSdkBlock}${tfPrefix}4;`;
    },
  );
  out = out.replace(
    /(PRODUCT_BUNDLE_IDENTIFIER = "com\.phaedrus75\.runzen\.watchkitapp";)([\s\S]*?)(\t\t\t\tTARGETED_DEVICE_FAMILY = )4;/g,
    (m, bundleLine, middle, tfPrefix) => {
      if (middle.includes('SDKROOT = watchos')) return m;
      return `${bundleLine}${middle}${watchSdkBlock}${tfPrefix}4;`;
    },
  );
  return out;
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
  out = patchWatchOSInPbxproj(out);
  return out;
}

/**
 * @param {string} projectRoot — Expo project root (…/frontend)
 * @param {string} iosRoot — …/frontend/ios
 * @param {{ appleTeamId?: string, version?: string, buildNumber?: string }} [options]
 */
function embedZenRunWatchApp(projectRoot, iosRoot, options = {}) {
  const { appleTeamId, version, buildNumber } = options;
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
  syncWatchAppVersion(
    [path.join(extDest, 'Info.plist'), path.join(appDest, 'Info.plist')],
    version,
    buildNumber,
  );

  const pbxPath = findPbxproj(iosRoot);
  const proj = xcode.project(pbxPath);
  proj.parseSync();
  ensurePbxDependencySections(proj);

  if (watchTargetsAlreadyPresent(proj)) {
    ensureWatchTargetDependencies(proj);
    ensureWatchTargetDevelopmentTeam(proj, appleTeamId);
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
  proj.updateBuildProperty('INFOPLIST_FILE', plistExt, undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('INFOPLIST_FILE', plistApp, undefined, APP_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('SDKROOT', 'watchos', undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('SDKROOT', 'watchos', undefined, APP_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty(
    'SUPPORTED_PLATFORMS',
    '"watchos watchsimulator"',
    undefined,
    EXT_NATIVE_TARGET_COMMENT,
  );
  proj.updateBuildProperty(
    'SUPPORTED_PLATFORMS',
    '"watchos watchsimulator"',
    undefined,
    APP_NATIVE_TARGET_COMMENT,
  );
  proj.updateBuildProperty('WATCHOS_DEPLOYMENT_TARGET', '10.0', undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('WATCHOS_DEPLOYMENT_TARGET', '10.0', undefined, APP_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('TARGETED_DEVICE_FAMILY', '4', undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('TARGETED_DEVICE_FAMILY', '4', undefined, APP_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('SKIP_INSTALL', 'YES', undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('SKIP_INSTALL', 'YES', undefined, APP_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('SWIFT_VERSION', '5.0', undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('SWIFT_VERSION', '5.0', undefined, APP_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('CODE_SIGN_STYLE', 'Automatic', undefined, EXT_NATIVE_TARGET_COMMENT);
  proj.updateBuildProperty('CODE_SIGN_STYLE', 'Automatic', undefined, APP_NATIVE_TARGET_COMMENT);

  proj.updateBuildProperty('WK_WATCHKIT_APP', 'YES', undefined, 'ZenRun');

  ensureWatchTargetDependencies(proj);
  ensureWatchTargetDevelopmentTeam(proj, appleTeamId);

  fs.writeFileSync(pbxPath, sanitizePbxprojText(proj.writeSync()));
}

module.exports = { embedZenRunWatchApp, default: embedZenRunWatchApp };

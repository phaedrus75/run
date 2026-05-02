/**
 * embedZenRunWatchApp
 * -------------------
 * Adds a modern single-target SwiftUI watchOS app to the iOS Xcode project.
 *
 * Architecture (Xcode 14+ / watchOS 9+):
 *   - One target: `ZenRunWatch`, productType `com.apple.product-type.application`.
 *   - SDKROOT=watchos, TARGETED_DEVICE_FAMILY=4.
 *   - No separate WatchKit Extension target — the deprecated
 *     `application.watchapp2` / `watchkit2-extension` split is gone.
 *   - The iPhone target embeds the watch .app via a PBXCopyFilesBuildPhase
 *     ("Embed Watch Content") so the IPA contains it under
 *     `Payload/ZenRun.app/Watch/ZenRunWatch.app`.
 *
 * Source-of-truth lives at `<projectRoot>/../watch-app/ZenRunWatch/` and is
 * copied to `<iosRoot>/ZenRunWatch/` on every prebuild. The plugin is
 * idempotent — when the watchOS target already exists it only refreshes the
 * source files, version strings, and signing settings.
 */

const fs = require('fs');
const path = require('path');
const xcode = require('xcode');
const pbxFile = require('xcode/lib/pbxFile');

const APP_NAME = 'ZenRunWatch';
const APP_TARGET_FIND_KEY = `"${APP_NAME}"`;
const WATCH_BUNDLE_ID = 'com.phaedrus75.runzen.watchkitapp';
const PHONE_BUNDLE_ID = 'com.phaedrus75.runzen';
const WATCHOS_DEPLOYMENT_TARGET = '9.0';

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

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
 * Apple validation requires the watch app's CFBundleShortVersionString to
 * match the iPhone app's. Build number (CFBundleVersion) must also match per
 * App Store Connect rules. Substitute both via simple regex — the source
 * Info.plist holds placeholder values that we overwrite on every prebuild.
 */
function syncWatchAppVersion(plistPath, version, buildNumber) {
  if (!fs.existsSync(plistPath)) return;
  const escape = (v) =>
    String(v).replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
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

/**
 * Copy `assets/icon.png` into the watch app's AppIcon.appiconset so the
 * IPA passes Apple's "Missing Icons" validation. We write a minimal
 * watchos-platform Contents.json alongside it.
 */
function ensureAppIcon(iosRoot, projectRoot) {
  const iconSrc = path.join(projectRoot, 'assets', 'icon.png');
  if (!fs.existsSync(iconSrc)) return;
  const iconDir = path.join(iosRoot, APP_NAME, 'Assets.xcassets', 'AppIcon.appiconset');
  fs.mkdirSync(iconDir, { recursive: true });
  fs.copyFileSync(iconSrc, path.join(iconDir, 'AppIcon.png'));
  // The source-of-truth Contents.json files are also copied; this is a
  // belt-and-braces overwrite in case we ever lose them.
  fs.writeFileSync(
    path.join(iconDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          { filename: 'AppIcon.png', idiom: 'universal', platform: 'watchos', size: '1024x1024' },
        ],
        info: { version: 1, author: 'xcode' },
      },
      null,
      2,
    ),
  );
}

// ---------------------------------------------------------------------------
// Xcode project mutators
// ---------------------------------------------------------------------------

/**
 * Expo's template pbxproj often has empty PBXTargetDependency /
 * PBXContainerItemProxy sections. node-xcode's addTargetDependency silently
 * skips work when those are missing, so the iPhone target never depends on
 * the watch target and the archive can race ahead of the watch build.
 */
function ensurePbxDependencySections(proj) {
  const objs = proj.hash.project.objects;
  if (!objs.PBXTargetDependency) objs.PBXTargetDependency = {};
  if (!objs.PBXContainerItemProxy) objs.PBXContainerItemProxy = {};
}

function findWatchTarget(proj) {
  return proj.findTargetKey(APP_TARGET_FIND_KEY);
}

/**
 * Wipes any prior watch app target (legacy or modern) so we can re-add a
 * clean one. Used when the existing target doesn't match the modern
 * product type — historically we shipped `application.watchapp2`.
 */
function removeStaleWatchTargets(proj) {
  const section = proj.pbxNativeTargetSection();
  const stale = [];
  for (const key of Object.keys(section)) {
    if (key.endsWith('_comment')) continue;
    const t = section[key];
    if (!t || typeof t !== 'object') continue;
    const productType = String(t.productType || '').replace(/"/g, '');
    const name = String(t.name || '').replace(/"/g, '');
    const isWatch =
      name === APP_NAME ||
      name === 'ZenRunWatch WatchKit Extension' ||
      productType === 'com.apple.product-type.application.watchapp2' ||
      productType === 'com.apple.product-type.watchkit2-extension';
    if (isWatch) stale.push({ uuid: key, name });
  }
  for (const s of stale) {
    try {
      proj.removeTarget(s.uuid);
    } catch (_) {
      // node-xcode's removeTarget can throw on partial sections; fall through
      // and let the addTarget below recreate the canonical entries.
    }
  }
}

/**
 * Add an "Embed Watch Content" copy-files build phase to the iPhone target.
 * The watch app .app needs to land at `$(CONTENTS_FOLDER_PATH)/Watch/`
 * inside the iPhone .app bundle.
 *
 * We construct the phase manually because node-xcode's helpers don't offer
 * the right `dstSubfolderSpec` for watch embedding.
 */
function ensureEmbedWatchContentPhase(proj, watchUuid) {
  const phoneUuid = proj.getFirstTarget().uuid;
  const phoneTarget = proj.pbxNativeTargetSection()[phoneUuid];
  if (!phoneTarget) return;

  // Idempotent: skip if the phase already exists.
  const existing = (phoneTarget.buildPhases || []).find(
    (bp) => String(bp.comment || '').includes('Embed Watch Content'),
  );

  // Locate the watch app's product reference so we can copy its .app.
  const productRef = proj.pbxNativeTargetSection()[watchUuid] &&
    proj.pbxNativeTargetSection()[watchUuid].productReference;
  if (!productRef) return;

  // The PBXBuildFile that wraps the productReference for the copy phase.
  const objs = proj.hash.project.objects;
  if (!objs.PBXBuildFile) objs.PBXBuildFile = {};
  if (!objs.PBXCopyFilesBuildPhase) objs.PBXCopyFilesBuildPhase = {};

  let buildFileUuid;
  for (const key of Object.keys(objs.PBXBuildFile)) {
    if (key.endsWith('_comment')) continue;
    const bf = objs.PBXBuildFile[key];
    if (
      bf &&
      String(bf.fileRef).replace(/"/g, '') === String(productRef).replace(/"/g, '') &&
      String(bf.settings || '').includes('RemoveHeadersOnCopy')
    ) {
      buildFileUuid = key;
      break;
    }
  }
  if (!buildFileUuid) {
    buildFileUuid = proj.generateUuid();
    objs.PBXBuildFile[buildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: productRef,
      settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
    };
    objs.PBXBuildFile[`${buildFileUuid}_comment`] = `${APP_NAME}.app in Embed Watch Content`;
  }

  if (existing) {
    // Phase already wired up; ensure the build file is present.
    const phaseUuid = existing.value;
    const phase = objs.PBXCopyFilesBuildPhase[phaseUuid];
    if (phase) {
      phase.files = phase.files || [];
      const already = phase.files.some(
        (f) => String(f.value).replace(/"/g, '') === String(buildFileUuid).replace(/"/g, ''),
      );
      if (!already) {
        phase.files.push({ value: buildFileUuid, comment: `${APP_NAME}.app in Embed Watch Content` });
      }
    }
    return;
  }

  const phaseUuid = proj.generateUuid();
  objs.PBXCopyFilesBuildPhase[phaseUuid] = {
    isa: 'PBXCopyFilesBuildPhase',
    buildActionMask: 2147483647,
    // Pbxproj string values containing $/(/) must be wrapped in literal
    // quotes inside the JS string. CocoaPods' Nanaimo parser is stricter
    // than Xcode's and will refuse to parse `$(CONTENTS_FOLDER_PATH)/Watch`
    // without them. Compare node-xcode's own watch2_app code in
    // pbxProject.js which uses `'"$(CONTENTS_FOLDER_PATH)/Watch"'`.
    dstPath: '"$(CONTENTS_FOLDER_PATH)/Watch"',
    dstSubfolderSpec: 16,
    files: [{ value: buildFileUuid, comment: `${APP_NAME}.app in Embed Watch Content` }],
    name: '"Embed Watch Content"',
    runOnlyForDeploymentPostprocessing: 0,
  };
  objs.PBXCopyFilesBuildPhase[`${phaseUuid}_comment`] = 'Embed Watch Content';

  phoneTarget.buildPhases = phoneTarget.buildPhases || [];
  phoneTarget.buildPhases.push({ value: phaseUuid, comment: 'Embed Watch Content' });
}

/**
 * Make sure the iPhone target depends on the watch target so Xcode builds
 * the .app before the embed phase tries to copy it.
 */
function ensureWatchDependency(proj, watchUuid) {
  ensurePbxDependencySections(proj);
  const phoneUuid = proj.getFirstTarget().uuid;
  const nt = proj.pbxNativeTargetSection();
  const phoneTarget = nt[phoneUuid];
  if (!phoneTarget) return;
  const depSection = proj.hash.project.objects.PBXTargetDependency;

  const alreadyDepends = (phoneTarget.dependencies || []).some((d) => {
    const row = depSection[d.value];
    return row && String(row.target).replace(/"/g, '') === String(watchUuid).replace(/"/g, '');
  });
  if (alreadyDepends) return;
  proj.addTargetDependency(phoneUuid, [watchUuid]);
}

/**
 * Wire all .swift files from the watch sources directory into the watch
 * target's Sources build phase. Idempotent — skips files already present.
 */
function ensureSwiftSources(proj, watchUuid, watchDest, groupKey) {
  const sourcesPhase = proj.pbxSourcesBuildPhaseObj(watchUuid);
  if (!sourcesPhase) return;
  const present = new Set(
    (sourcesPhase.files || []).map((f) => String(f.comment || '').replace(/ in Sources$/, '').trim()),
  );
  for (const fname of fs.readdirSync(watchDest).filter((f) => f.endsWith('.swift'))) {
    if (present.has(fname)) continue;
    const rel = `${APP_NAME}/${fname}`;
    proj.addSourceFile(rel, { target: watchUuid }, groupKey);
  }
}

function ensureAssetsResource(proj, watchUuid, groupKey) {
  const phase = proj.pbxResourcesBuildPhaseObj(watchUuid);
  if (!phase) return;
  const already = (phase.files || []).some((f) => String(f.comment || '').includes('Assets.xcassets'));
  if (already) return;
  const file = new pbxFile(`${APP_NAME}/Assets.xcassets`);
  file.uuid = proj.generateUuid();
  file.fileRef = proj.generateUuid();
  file.target = watchUuid;
  proj.addToPbxFileReferenceSection(file);
  proj.addToPbxBuildFileSection(file);
  proj.addToPbxResourcesBuildPhase(file);
  if (groupKey) proj.addToPbxGroup(file, groupKey);
}

// ---------------------------------------------------------------------------
// Build settings injection — node-xcode's updateBuildProperty doesn't always
// land cleanly for the modern application product type because Xcode treats
// the configurations differently from extension types.
// ---------------------------------------------------------------------------

const TARGET_NAME_QUOTED = `"${APP_NAME}"`;

function setWatchBuildProperty(proj, key, value) {
  proj.updateBuildProperty(key, value, undefined, TARGET_NAME_QUOTED);
}

function applyWatchBuildSettings(proj, appleTeamId) {
  setWatchBuildProperty(proj, 'INFOPLIST_FILE', `"${APP_NAME}/Info.plist"`);
  setWatchBuildProperty(proj, 'PRODUCT_BUNDLE_IDENTIFIER', WATCH_BUNDLE_ID);
  setWatchBuildProperty(proj, 'PRODUCT_NAME', `"$(TARGET_NAME)"`);
  setWatchBuildProperty(proj, 'SDKROOT', 'watchos');
  setWatchBuildProperty(proj, 'SUPPORTED_PLATFORMS', '"watchos watchsimulator"');
  setWatchBuildProperty(proj, 'WATCHOS_DEPLOYMENT_TARGET', WATCHOS_DEPLOYMENT_TARGET);
  setWatchBuildProperty(proj, 'TARGETED_DEVICE_FAMILY', '4');
  setWatchBuildProperty(proj, 'SKIP_INSTALL', 'YES');
  setWatchBuildProperty(proj, 'SWIFT_VERSION', '5.0');
  setWatchBuildProperty(proj, 'CODE_SIGN_STYLE', 'Automatic');
  setWatchBuildProperty(proj, 'ASSETCATALOG_COMPILER_APPICON_NAME', 'AppIcon');
  setWatchBuildProperty(proj, 'GENERATE_INFOPLIST_FILE', 'NO');
  if (appleTeamId) setWatchBuildProperty(proj, 'DEVELOPMENT_TEAM', appleTeamId);
}

/**
 * Belt-and-braces fixup for the textual pbxproj. node-xcode occasionally
 * emits configuration blocks where TARGETED_DEVICE_FAMILY ends up as "1,2"
 * or where SDKROOT is missing for the watch target's bundle ID. This
 * regex pass coerces them to watchOS values without touching the iPhone
 * target's own configurations.
 */
function patchWatchOSInPbxproj(body) {
  const tab = '\t\t\t\t';
  const watchSdkBlock =
    `${tab}SDKROOT = watchos;\n` +
    `${tab}SUPPORTED_PLATFORMS = "watchos watchsimulator";\n` +
    `${tab}WATCHOS_DEPLOYMENT_TARGET = ${WATCHOS_DEPLOYMENT_TARGET};\n` +
    `${tab}SWIFT_VERSION = 5.0;\n`;

  const bundlePatterns = [
    `PRODUCT_BUNDLE_IDENTIFIER = "${WATCH_BUNDLE_ID}";`,
    `PRODUCT_BUNDLE_IDENTIFIER = ${WATCH_BUNDLE_ID};`,
  ];

  let out = body;
  for (const bundleLine of bundlePatterns) {
    const escaped = bundleLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 1,2 → 4 + ensure SDK block
    out = out.replace(
      new RegExp(`(${escaped})([\\s\\S]*?)(${tab}TARGETED_DEVICE_FAMILY = )"1,2";`, 'g'),
      (_m, line, middle, tfPrefix) => {
        if (middle.includes('SDKROOT = watchos')) {
          const platforms = middle.includes('SUPPORTED_PLATFORMS')
            ? ''
            : `${tab}SUPPORTED_PLATFORMS = "watchos watchsimulator";\n`;
          return `${line}${middle}${platforms}${tfPrefix}4;`;
        }
        return `${line}${middle}${watchSdkBlock}${tfPrefix}4;`;
      },
    );
    // already 4 but missing SDK block
    out = out.replace(
      new RegExp(`(${escaped})([\\s\\S]*?)(${tab}TARGETED_DEVICE_FAMILY = )4;`, 'g'),
      (m, line, middle, tfPrefix) => {
        if (middle.includes('SDKROOT = watchos')) return m;
        return `${line}${middle}${watchSdkBlock}${tfPrefix}4;`;
      },
    );
  }
  return out;
}

function sanitizePbxprojText(body) {
  // node-xcode bug: pbxCreateGroup quotes the isa, which breaks CocoaPods.
  let out = body.replace(/isa = "PBXGroup";/g, 'isa = PBXGroup;');
  // Some Expo templates emit suffixed Info.plist names; force ours back.
  out = out.replace(
    /INFOPLIST_FILE = "ZenRunWatch\/ZenRunWatch-Info\.plist";/g,
    'INFOPLIST_FILE = "ZenRunWatch/Info.plist";',
  );
  out = patchWatchOSInPbxproj(out);
  return out;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * @param {string} projectRoot — Expo project root (…/frontend)
 * @param {string} iosRoot     — …/frontend/ios
 * @param {{ appleTeamId?: string, version?: string, buildNumber?: string }} [options]
 */
function embedZenRunWatchApp(projectRoot, iosRoot, options = {}) {
  const { appleTeamId, version, buildNumber } = options;
  const watchSrc = path.join(projectRoot, '..', 'watch-app', APP_NAME);
  if (!fs.existsSync(watchSrc)) {
    console.warn('[withWatchApp] Source not found at', watchSrc);
    return;
  }
  const watchDest = path.join(iosRoot, APP_NAME);

  // 1. Sync source files into the iOS folder.
  copyRecursive(watchSrc, watchDest);
  ensureAppIcon(iosRoot, projectRoot);
  syncWatchAppVersion(path.join(watchDest, 'Info.plist'), version, buildNumber);

  // 2. Mutate project.pbxproj.
  const pbxPath = findPbxproj(iosRoot);
  const proj = xcode.project(pbxPath);
  proj.parseSync();
  ensurePbxDependencySections(proj);

  // Wipe any prior watch targets (legacy or modern) so re-runs are clean.
  // The product files / build configurations stick around but addTarget below
  // re-uses them by name.
  let watchUuid = findWatchTarget(proj);
  if (watchUuid) {
    const existing = proj.pbxNativeTargetSection()[watchUuid];
    const productType = String((existing && existing.productType) || '').replace(/"/g, '');
    if (productType !== 'com.apple.product-type.application') {
      removeStaleWatchTargets(proj);
      watchUuid = null;
    }
  } else {
    // Always sweep stale entries (e.g. WatchKit Extension) before adding fresh.
    removeStaleWatchTargets(proj);
  }

  // 3. Create the watch target if needed. We bypass node-xcode's
  // `addTarget('watch_app', …)` (no such helper for modern single-target) and
  // use the lower-level `application` registration which yields a clean
  // PBXNativeTarget with productType `com.apple.product-type.application`.
  if (!watchUuid) {
    const newTarget = proj.addTarget(APP_NAME, 'application', APP_NAME, WATCH_BUNDLE_ID);
    if (!newTarget || !newTarget.uuid) {
      throw new Error('[withWatchApp] addTarget returned no uuid — aborting');
    }
    watchUuid = newTarget.uuid;
    proj.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', watchUuid);
    proj.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', watchUuid);
    proj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', watchUuid);
    proj.addFramework('System/Library/Frameworks/WatchConnectivity.framework', {
      target: watchUuid,
      customFramework: false,
    });
  }

  // 4. Wire sources, assets, settings, embed phase, and dependency.
  const groupKey = proj.findPBXGroupKey({ name: 'ZenRun' });
  ensureSwiftSources(proj, watchUuid, watchDest, groupKey);
  ensureAssetsResource(proj, watchUuid, groupKey);
  applyWatchBuildSettings(proj, appleTeamId);
  ensureWatchDependency(proj, watchUuid);
  ensureEmbedWatchContentPhase(proj, watchUuid);

  // 5. Persist with our textual fixups.
  fs.writeFileSync(pbxPath, sanitizePbxprojText(proj.writeSync()));
}

module.exports = { embedZenRunWatchApp, default: embedZenRunWatchApp };

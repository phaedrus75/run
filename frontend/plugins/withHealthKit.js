/**
 * withHealthKit
 * -------------
 * Apple's TestFlight validation requires the iPhone companion app to ALSO
 * declare HealthKit when its paired watchOS app uses it — even when the
 * iPhone target doesn't actually call HealthKit APIs. Our iPhone app falls
 * into that bucket: HKWorkoutSession runs on the watch (so live workouts
 * survive screen-off), and the iPhone receives the resulting payload via
 * `WatchConnectivity` only.
 *
 * This plugin:
 *   1. Adds `com.apple.developer.healthkit` (boolean true) and an empty
 *      `com.apple.developer.healthkit.access` array to the iPhone target's
 *      entitlements file. Apple ignores the entitlement at runtime if the
 *      app never calls HealthKit, but the *capability* must be visible to
 *      App Store Connect for the watch to ship.
 *   2. Ensures the matching NSHealth* usage strings are present in
 *      Info.plist. Apple rejects HK-capable IPAs that lack these strings
 *      even if the user is never asked for permission on the iPhone.
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
function withHealthKit(config) {
  const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

  const withEntitlements = withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['com.apple.developer.healthkit'] = true;
    if (!Array.isArray(cfg.modResults['com.apple.developer.healthkit.access'])) {
      cfg.modResults['com.apple.developer.healthkit.access'] = [];
    }
    return cfg;
  });

  return withInfoPlist(withEntitlements, (cfg) => {
    if (!cfg.modResults.NSHealthShareUsageDescription) {
      cfg.modResults.NSHealthShareUsageDescription =
        'ZenRun reads your watch workouts so they appear alongside your runs and walks on this iPhone.';
    }
    if (!cfg.modResults.NSHealthUpdateUsageDescription) {
      cfg.modResults.NSHealthUpdateUsageDescription =
        'ZenRun stores your workouts so you can review them later. The actual recording happens on your Apple Watch.';
    }
    return cfg;
  });
}

module.exports = withHealthKit;

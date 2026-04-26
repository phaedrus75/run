/**
 * @type {import('@expo/config-plugins').ConfigPlugin}
 * Uses `withFinalizedMod` so the watch app runs after other iOS plugins (e.g. autolinking)
 * have finished writing `project.pbxproj`. `withDangerousMod` runs first and our settings were overwritten.
 */
function withWatchApp(config) {
  const { withFinalizedMod } = require('@expo/config-plugins');
  const { embedZenRunWatchApp } = require('./embedZenRunWatchApp.cjs');

  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      try {
        embedZenRunWatchApp(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      } catch (e) {
        console.warn('[withWatchApp]', e && e.message ? e.message : e);
      }
      return cfg;
    },
  ]);
}

module.exports = withWatchApp;

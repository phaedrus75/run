/**
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
function withWatchApp(config) {
  const { withDangerousMod } = require('@expo/config-plugins');
  const { embedZenRunWatchApp } = require('./embedZenRunWatchApp.cjs');

  return withDangerousMod(config, [
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

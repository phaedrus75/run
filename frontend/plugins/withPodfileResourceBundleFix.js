/**
 * Xcode 14+ tries to sign every pod resource bundle, which fails on EAS without a development team
 * for those targets. Injects a `CODE_SIGNING_ALLOWED = NO` block into the existing `post_install`
 * block in `ios/Podfile` so resource bundles aren't signed.
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
function withPodfileResourceBundleFix(config) {
  const { withPodfile } = require('@expo/config-plugins');
  const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

  return withPodfile(config, (cfg) => {
    const newSrc = [
      '    installer.target_installation_results.pod_target_installation_results.each do |pod_name, target_installation_result|',
      '      target_installation_result.resource_bundle_targets.each do |resource_bundle_target|',
      '        resource_bundle_target.build_configurations.each do |bundle_config|',
      "          bundle_config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'",
      '        end',
      '      end',
      '    end',
    ].join('\n');

    try {
      const result = mergeContents({
        tag: 'zenrun-disable-resource-bundle-signing',
        src: cfg.modResults.contents,
        newSrc,
        anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\)/,
        offset: 2,
        comment: '#',
      });
      if (result.didMerge || result.didClear) {
        cfg.modResults.contents = result.contents;
      }
    } catch (e) {
      console.warn('[withPodfileResourceBundleFix]', e && e.message ? e.message : e);
    }
    return cfg;
  });
}

module.exports = withPodfileResourceBundleFix;

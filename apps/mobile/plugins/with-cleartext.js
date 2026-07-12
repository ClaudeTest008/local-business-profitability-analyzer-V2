const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Testing builds talk to a local/LAN API over plain http (no TLS on a dev box).
 * Release manifests block cleartext by default; allow it explicitly.
 * ponytail: acceptable for test distribution — switch the API to https and drop
 * this plugin before any store release.
 */
module.exports = function withCleartext(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return cfg;
  });
};

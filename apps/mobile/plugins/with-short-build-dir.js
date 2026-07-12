const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const ROOT_SNIPPET = `
// with-short-build-dir: Windows MAX_PATH — relocate library CMake staging (.cxx)
// dirs to a short root. Staging-only: buildDirs stay put (autolinking hardcodes them).
subprojects { proj ->
  proj.plugins.withId('com.android.library') {
    if (System.getProperty('os.name').toLowerCase().contains('windows')) {
      proj.android.externalNativeBuild.cmake.buildStagingDirectory =
        "C:/b/lboa/cxx/\${proj.name}"
    }
  }
}
`;

/**
 * Windows MAX_PATH workaround: the :app CMake staging dir (.cxx) holds ninja object
 * files whose names embed full source paths and exceed 260 chars in deep checkouts.
 * Relocating ONLY the staging dir is safe; relocating buildDirs breaks expo
 * autolinking (hardcoded codegen paths) and reanimated's CMake glob cache.
 */
const APP_SNIPPET = `
// with-short-build-dir: Windows MAX_PATH workaround — relocate CMake staging (.cxx),
// where ninja object paths embed full source paths and blow the 260-char limit.
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  android.externalNativeBuild.cmake.buildStagingDirectory = "C:/b/lboa/cxx"
}
`;

module.exports = function withShortBuildDir(config) {
  config = withProjectBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('with-short-build-dir')) {
      cfg.modResults.contents += ROOT_SNIPPET;
    }
    return cfg;
  });
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('with-short-build-dir')) {
      cfg.modResults.contents += APP_SNIPPET;
    }
    return cfg;
  });
};

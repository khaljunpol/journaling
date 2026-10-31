// Windows' 260-character path limit breaks the C++ build from a deep folder, because the object
// paths repeat the whole project path. Set WIDGET_CXX_DIR to a short folder (for example C:/jwcxx)
// and only that step moves there. Without the variable nothing changes.
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCK = `
// Added by plugins/with-short-cxx-dir.js
if (System.getenv("WIDGET_CXX_DIR")) {
    android.externalNativeBuild.cmake.buildStagingDirectory = System.getenv("WIDGET_CXX_DIR")
}
`;

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('WIDGET_CXX_DIR')) c.modResults.contents += BLOCK;
    return c;
  });

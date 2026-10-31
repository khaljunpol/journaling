// Makes the app a floating window: the home screen stays visible and dimmed behind the popups.
// The dim comes from the theme, so it shows at once, before JS loads.
const { withAndroidStyles } = require('expo/config-plugins');

const ITEMS = {
  'android:windowIsTranslucent': 'true',
  'android:windowBackground': '@android:color/transparent',
  'android:backgroundDimEnabled': 'true',
  'android:backgroundDimAmount': '0.6',
  'android:windowContentOverlay': '@null',
};

module.exports = (config) =>
  withAndroidStyles(config, (c) => {
    for (const style of c.modResults.resources.style ?? []) {
      if (style.$.name !== 'AppTheme' && style.$.name !== 'Theme.App.SplashScreen') continue;
      style.item = (style.item ?? []).filter((i) => !(i.$.name in ITEMS));
      for (const [name, value] of Object.entries(ITEMS)) style.item.push({ _: value, $: { name } });
    }
    return c;
  });

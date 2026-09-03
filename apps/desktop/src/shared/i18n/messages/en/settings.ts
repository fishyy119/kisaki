/** Settings dialog: section titles, field labels, options, and descriptions. */
export const settings = {
  title: 'Settings',
  sections: {
    appearance: 'Appearance',
    window: 'Startup and window',
    updates: 'Updates'
  },
  themeLabel: 'Theme',
  themeModeLabel: 'Theme mode',
  interfaceScaleLabel: 'Interface scale',
  interfaceScaleValue: ({ scale }: { scale: number }) => `${scale}%`,
  autoLaunchLabel: 'Launch at startup',
  closeActionLabel: 'When closing the window',
  closeActionExit: 'Quit the app',
  closeActionTray: 'Minimize to tray',
  updaterAutoCheckLabel: 'Check for updates automatically',
  updaterAllowPrereleaseLabel: 'Receive preview updates',
  loadFailed: 'Failed to load settings',
  language: {
    followSystem: 'Follow system',
    uiLanguageLabel: 'Interface language'
  }
}

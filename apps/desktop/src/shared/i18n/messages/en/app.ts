/** App shell: tray, 404 page, and the global error boundary. */
export const app = {
  quit: 'Quit Kisaki',
  notFound: {
    title: 'Page not found',
    description: 'The page you requested does not exist',
    backToLibrary: 'Back to library'
  },
  error: {
    title: 'Application error',
    description: 'Sorry, the app ran into an error',
    messageLabel: 'Error message',
    stackLabel: 'Stack trace',
    reload: 'Reload app'
  },
  about: {
    title: 'About Kisaki',
    tagline1: 'Kisaki is an ACGN library manager.',
    tagline2: 'It aims to provide one coherent interface and data model',
    tagline3:
      'for recording, managing, building, syncing, and showcasing your collections and memories.',
    authorLabel: 'Author',
    authorName: 'ximu',
    repoLabel: 'Repository',
    repoLink: 'GitHub repository',
    feedbackLabel: 'Feedback',
    feedbackLink: 'GitHub Issues',
    communityLabel: 'Community',
    telegramGroup: 'Telegram group',
    versionLabel: 'Version',
    checkUpdates: 'Check for updates',
    readVersionFailed: 'Could not read the version'
  }
}

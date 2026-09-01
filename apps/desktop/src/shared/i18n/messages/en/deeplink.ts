/**
 * Deeplink outcomes: feedback for external `kisaki://` links that fail before
 * any owning flow exists (invalid or unmatched links), extension route
 * availability, and unknown `open` destinations.
 */
export const deeplink = {
  invalidLinkTitle: 'Invalid link',
  invalidLinkMessage: 'Kisaki could not read this link.',
  unknownLinkTitle: 'Unknown link',
  unknownLinkMessage: 'Kisaki has no action for this link.',
  extensionUnavailableTitle: 'Extension link failed',
  extensionUnavailableMessage: 'The extension for this link is not installed or not running.',
  unknownDestinationTitle: 'Unknown destination',
  unknownDestinationMessage: 'This link points to a page this version of Kisaki does not know.'
}

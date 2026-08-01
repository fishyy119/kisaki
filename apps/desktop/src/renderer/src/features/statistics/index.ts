// Page components are not re-exported: routing lazy-loads them from their
// .vue files, and a static page export here would put pages back inside the
// shared import graph cycle that breaks HMR.
export { statisticsData } from './composables'

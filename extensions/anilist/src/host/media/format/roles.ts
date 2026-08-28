import type {
  LibraryAnimeCharacterRole,
  LibraryAnimePersonRole,
  LibraryComicPersonRole,
  LibraryGender,
  LibraryMediaRelationType,
  LibraryNovelPersonRole
} from '@kisaki3/extension-sdk'

/**
 * AniList staff roles are free text ("Director", "Original Creator", "Key
 * Animation (eps 3, 7)"); mapping matches on the stable phrase and keeps the
 * original wording as the fact's note, so nothing the source said is lost.
 */
export function mapAnimePersonRole(role: string): LibraryAnimePersonRole {
  const value = role.toLowerCase()

  if (value.includes('original') && (value.includes('creator') || value.includes('story'))) {
    return 'originalCreator'
  }
  if (value.includes('series composition')) {
    return 'seriesComposition'
  }
  if (value.includes('script') || value.includes('screenplay')) {
    return 'scenario'
  }
  if (value.includes('episode director')) {
    return 'episodeDirector'
  }
  if (value.includes('character design')) {
    return 'characterDesign'
  }
  if (value.includes('animation director') || value.includes('chief animation')) {
    return 'animationDirector'
  }
  if (value.includes('animation')) {
    return 'animation'
  }
  if (value.includes('art director') || value.includes('background art')) {
    return 'art'
  }
  if (value.includes('photograph')) {
    return 'photography'
  }
  if (value.includes('sound')) {
    return 'sound'
  }
  if (value.includes('music') || value.includes('theme song') || value.includes('composer')) {
    return 'music'
  }
  if (value.includes('director')) {
    return 'director'
  }

  return 'other'
}

export function mapComicPersonRole(role: string): LibraryComicPersonRole {
  const value = role.toLowerCase()

  if (value.includes('story') && value.includes('art')) {
    return 'author'
  }
  if (value.includes('original')) {
    return 'originalCreator'
  }
  if (value.includes('art') || value.includes('illustrat')) {
    return 'art'
  }
  if (value.includes('story')) {
    return 'author'
  }

  return 'other'
}

export function mapNovelPersonRole(role: string): LibraryNovelPersonRole {
  const value = role.toLowerCase()

  if (value.includes('illustrat') || value.includes('art')) {
    return 'illustrator'
  }
  if (value.includes('original')) {
    return 'originalCreator'
  }
  if (value.includes('story') || value.includes('author')) {
    return 'author'
  }

  return 'other'
}

/** Character roles share one vocabulary across the media types. */
export function mapCharacterRole(role: string | null | undefined): LibraryAnimeCharacterRole {
  switch (role) {
    case 'MAIN':
      return 'main'
    case 'SUPPORTING':
      return 'supporting'
    case 'BACKGROUND':
      return 'cameo'
    default:
      return 'other'
  }
}

export function mapGender(value: string | null | undefined): LibraryGender | undefined {
  switch (value?.trim().toLowerCase()) {
    case 'male':
      return 'male'
    case 'female':
      return 'female'
    case undefined:
    case '':
      return undefined
    default:
      return 'other'
  }
}

export function mapRelationType(value: string | null | undefined): LibraryMediaRelationType {
  switch (value) {
    case 'SEQUEL':
      return 'sequel'
    case 'PREQUEL':
      return 'prequel'
    case 'SIDE_STORY':
    case 'SPIN_OFF':
      return 'sideStory'
    case 'PARENT':
      return 'parentStory'
    case 'SUMMARY':
      return 'summary'
    case 'COMPILATION':
      return 'fullStory'
    case 'ADAPTATION':
      return 'adaptation'
    case 'SOURCE':
      return 'sourceMaterial'
    case 'ALTERNATIVE':
      return 'alternative'
    default:
      return 'other'
  }
}

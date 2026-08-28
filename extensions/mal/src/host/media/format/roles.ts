import type {
  LibraryAnimeCharacterRole,
  LibraryAnimePersonRole,
  LibraryComicPersonRole,
  LibraryMediaRelationType,
  LibraryNovelPersonRole
} from '@kisaki3/extension-sdk'

/** MAL relation types are stable snake_case identifiers. */
export function mapRelationType(value: string | null | undefined): LibraryMediaRelationType {
  switch (value) {
    case 'sequel':
      return 'sequel'
    case 'prequel':
      return 'prequel'
    case 'side_story':
    case 'spin_off':
      return 'sideStory'
    case 'parent_story':
      return 'parentStory'
    case 'summary':
      return 'summary'
    case 'full_story':
      return 'fullStory'
    case 'adaptation':
      return 'adaptation'
    case 'alternative_version':
    case 'alternative_setting':
      return 'alternative'
    default:
      return 'other'
  }
}

/**
 * Mirror staff positions are display phrases ("Chief Animation Director",
 * "Theme Song Performance"); matching is on the stable keyword and the full
 * position list rides along as the fact's note.
 */
export function mapAnimeStaffPosition(position: string): LibraryAnimePersonRole {
  const value = position.toLowerCase()

  if (value.includes('original creator') || value.includes('original story')) {
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
  if (value.includes('animation director')) {
    return 'animationDirector'
  }
  if (value.includes('animation')) {
    return 'animation'
  }
  if (value.includes('art director') || value.includes('background art')) {
    return 'art'
  }
  if (value.includes('photography')) {
    return 'photography'
  }
  if (value.includes('sound')) {
    return 'sound'
  }
  if (value.includes('music') || value.includes('theme song')) {
    return 'music'
  }
  if (value.includes('producer')) {
    return 'producer'
  }
  if (value.includes('director')) {
    return 'director'
  }

  return 'other'
}

/** Picks the strongest role a staff member's position list states. */
export function mapAnimeStaffPositions(positions: readonly string[]): LibraryAnimePersonRole {
  for (const position of positions) {
    const role = mapAnimeStaffPosition(position)
    if (role !== 'other') {
      return role
    }
  }
  return 'other'
}

/** Official manga author roles are "Story", "Art", and "Story & Art". */
export function mapComicAuthorRole(role: string | null | undefined): LibraryComicPersonRole {
  const value = role?.toLowerCase() ?? ''

  if (value.includes('story')) {
    return 'author'
  }
  if (value.includes('art')) {
    return 'art'
  }

  return 'other'
}

export function mapNovelAuthorRole(role: string | null | undefined): LibraryNovelPersonRole {
  const value = role?.toLowerCase() ?? ''

  if (value.includes('story')) {
    return 'author'
  }
  if (value.includes('art')) {
    return 'illustrator'
  }

  return 'other'
}

export function mapCharacterRole(role: string | null | undefined): LibraryAnimeCharacterRole {
  switch (role?.trim().toLowerCase()) {
    case 'main':
      return 'main'
    case 'supporting':
      return 'supporting'
    default:
      return 'other'
  }
}

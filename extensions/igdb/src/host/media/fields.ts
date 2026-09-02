/**
 * Field selections for the Apicalypse queries.
 *
 * IGDB returns only what a query names, and reference fields come back as
 * plain ids, so each read names its own fields and the ids it yields are
 * resolved by follow-up by-id queries.
 */

export const GAME_CORE_FIELDS =
  'id,name,first_release_date,summary,storyline,url,game_type.type,game_status.status,websites,external_games,videos,release_dates,genres,themes,keywords,game_modes,player_perspectives,platforms,language_supports,cover,parent_game,version_parent,dlcs,expansions,standalone_expansions,expanded_games,remakes,remasters,ports,forks,bundles'

export const GAME_SEARCH_FIELDS = 'id,name,first_release_date'

export const WEBSITE_FIELDS = 'id,type,url,trusted'
export const WEBSITE_TYPE_FIELDS = 'id,type'
export const EXTERNAL_GAME_FIELDS = 'id,uid,url,external_game_source'
export const EXTERNAL_SOURCE_FIELDS = 'id,name'
export const VIDEO_FIELDS = 'id,name,video_id'
export const RELEASE_DATE_FIELDS = 'id,date,y,m,status'
export const NAMED_FIELDS = 'id,name'
export const LANGUAGE_SUPPORT_FIELDS = 'id,language,language_support_type'
export const LANGUAGE_FIELDS = 'id,name,native_name,locale'
export const IMAGE_FIELDS = 'id,image_id,url'

export const CHARACTER_FIELDS =
  'id,name,akas,description,country_name,character_gender,character_species,mug_shot,url'

export const INVOLVED_COMPANY_FIELDS = 'id,company,developer,publisher,porting,supporting'
export const COMPANY_FIELDS = 'id,name,description,url,logo,websites,start_date'
export const COMPANY_SEARCH_FIELDS = 'id,name'

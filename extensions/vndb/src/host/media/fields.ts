/**
 * Field selections for the Kana API.
 *
 * The API returns only what a query names, so each read asks for exactly the
 * fields its slots consume. The VN read is split in two because the core
 * fields answer info, tags, and images, while the relation fields are only
 * needed once a scrape reaches characters, staff, companies, or relations.
 */

export const VN_CORE_FIELDS =
  'id,title,alttitle,titles{lang,title,main,official,latin},released,description,extlinks{id,name,label,url},devstatus,length,length_minutes,languages,platforms,olang,tags{id,rating,spoiler,lie},image{id,url,thumbnail},screenshots{id,url,thumbnail}'

export const VN_RELATION_FIELDS =
  'id,va{note,staff{id},character{id}},staff{id,role,note},developers{id},relations{id,relation,relation_official}'

export const VN_SEARCH_FIELDS = 'id,title,alttitle,released,titles{lang,title,main,official,latin}'

export const CHARACTER_FIELDS =
  'id,name,original,description,sex,gender,birthday,blood_type,height,weight,bust,waist,hips,cup,image{id,url},traits{id,spoiler,lie,sexual},vns{id,role,spoiler}'

export const CHARACTER_SEARCH_FIELDS = 'id,name,original,birthday'

export const STAFF_FIELDS =
  'id,name,original,description,gender,lang,aliases{name,latin,ismain},extlinks{id,name,label,url}'

export const STAFF_SEARCH_FIELDS = 'id,name,original'

export const PRODUCER_FIELDS = 'id,name,original,description,type,lang,extlinks{id,name,label,url}'

export const PRODUCER_SEARCH_FIELDS = 'id,name,original'

export const RELEASE_FIELDS = 'id,producers{id,developer,publisher}'

export const TAG_FIELDS = 'id,name,category'

export const TRAIT_FIELDS = 'id,name,group_name,sexual'

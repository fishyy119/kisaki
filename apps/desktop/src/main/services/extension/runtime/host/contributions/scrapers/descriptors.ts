import {
  CHARACTER_SCRAPER_SLOTS,
  COMPANY_SCRAPER_SLOTS,
  GAME_SCRAPER_SLOTS,
  PERSON_SCRAPER_SLOTS,
  type HostToMainRpcMethod,
  type MainToHostRpcMethod
} from '@kisaki/extension-api'

export type ScraperRpcKind = 'games' | 'persons' | 'companies' | 'characters'

export type MainToHostScraperRpcMethods<TKind extends ScraperRpcKind = ScraperRpcKind> = {
  search: Extract<MainToHostRpcMethod, `contributions.scrapers.${TKind}.search`>
  resolve: Extract<MainToHostRpcMethod, `contributions.scrapers.${TKind}.resolve`>
  open: Extract<MainToHostRpcMethod, `contributions.scrapers.${TKind}.session.open`>
  get: Extract<MainToHostRpcMethod, `contributions.scrapers.${TKind}.session.get`>
  close: Extract<MainToHostRpcMethod, `contributions.scrapers.${TKind}.session.close`>
}

export interface MainToHostScraperRpcDescriptor<TKind extends ScraperRpcKind = ScraperRpcKind> {
  kind: TKind
  methods: MainToHostScraperRpcMethods<TKind>
}

export type HostToMainScraperRpcMethods<TKind extends ScraperRpcKind = ScraperRpcKind> = {
  register: Extract<HostToMainRpcMethod, `contributions.scrapers.${TKind}.register`>
  unregister: Extract<HostToMainRpcMethod, `contributions.scrapers.${TKind}.unregister`>
}

export interface HostToMainScraperRpcDescriptor<TKind extends ScraperRpcKind = ScraperRpcKind> {
  kind: TKind
  slots: readonly string[]
  methods: HostToMainScraperRpcMethods<TKind>
}

export const MAIN_TO_HOST_SCRAPER_RPC = {
  games: {
    kind: 'games',
    methods: {
      search: 'contributions.scrapers.games.search',
      resolve: 'contributions.scrapers.games.resolve',
      open: 'contributions.scrapers.games.session.open',
      get: 'contributions.scrapers.games.session.get',
      close: 'contributions.scrapers.games.session.close'
    }
  },
  persons: {
    kind: 'persons',
    methods: {
      search: 'contributions.scrapers.persons.search',
      resolve: 'contributions.scrapers.persons.resolve',
      open: 'contributions.scrapers.persons.session.open',
      get: 'contributions.scrapers.persons.session.get',
      close: 'contributions.scrapers.persons.session.close'
    }
  },
  companies: {
    kind: 'companies',
    methods: {
      search: 'contributions.scrapers.companies.search',
      resolve: 'contributions.scrapers.companies.resolve',
      open: 'contributions.scrapers.companies.session.open',
      get: 'contributions.scrapers.companies.session.get',
      close: 'contributions.scrapers.companies.session.close'
    }
  },
  characters: {
    kind: 'characters',
    methods: {
      search: 'contributions.scrapers.characters.search',
      resolve: 'contributions.scrapers.characters.resolve',
      open: 'contributions.scrapers.characters.session.open',
      get: 'contributions.scrapers.characters.session.get',
      close: 'contributions.scrapers.characters.session.close'
    }
  }
} as const satisfies {
  [K in ScraperRpcKind]: MainToHostScraperRpcDescriptor<K>
}

export const HOST_TO_MAIN_SCRAPER_RPC = {
  games: {
    kind: 'games',
    slots: GAME_SCRAPER_SLOTS,
    methods: {
      register: 'contributions.scrapers.games.register',
      unregister: 'contributions.scrapers.games.unregister'
    }
  },
  persons: {
    kind: 'persons',
    slots: PERSON_SCRAPER_SLOTS,
    methods: {
      register: 'contributions.scrapers.persons.register',
      unregister: 'contributions.scrapers.persons.unregister'
    }
  },
  companies: {
    kind: 'companies',
    slots: COMPANY_SCRAPER_SLOTS,
    methods: {
      register: 'contributions.scrapers.companies.register',
      unregister: 'contributions.scrapers.companies.unregister'
    }
  },
  characters: {
    kind: 'characters',
    slots: CHARACTER_SCRAPER_SLOTS,
    methods: {
      register: 'contributions.scrapers.characters.register',
      unregister: 'contributions.scrapers.characters.unregister'
    }
  }
} as const satisfies {
  [K in ScraperRpcKind]: HostToMainScraperRpcDescriptor<K>
}

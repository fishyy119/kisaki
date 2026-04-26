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
  search: Extract<MainToHostRpcMethod, `scrapers.${TKind}.search`>
  resolve: Extract<MainToHostRpcMethod, `scrapers.${TKind}.resolve`>
  open: Extract<MainToHostRpcMethod, `scrapers.${TKind}.session.open`>
  get: Extract<MainToHostRpcMethod, `scrapers.${TKind}.session.get`>
  close: Extract<MainToHostRpcMethod, `scrapers.${TKind}.session.close`>
}

export interface MainToHostScraperRpcDescriptor<TKind extends ScraperRpcKind = ScraperRpcKind> {
  kind: TKind
  methods: MainToHostScraperRpcMethods<TKind>
}

export type HostToMainScraperRpcMethods<TKind extends ScraperRpcKind = ScraperRpcKind> = {
  register: Extract<HostToMainRpcMethod, `bridge.scrapers.${TKind}.register`>
  unregister: Extract<HostToMainRpcMethod, `bridge.scrapers.${TKind}.unregister`>
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
      search: 'scrapers.games.search',
      resolve: 'scrapers.games.resolve',
      open: 'scrapers.games.session.open',
      get: 'scrapers.games.session.get',
      close: 'scrapers.games.session.close'
    }
  },
  persons: {
    kind: 'persons',
    methods: {
      search: 'scrapers.persons.search',
      resolve: 'scrapers.persons.resolve',
      open: 'scrapers.persons.session.open',
      get: 'scrapers.persons.session.get',
      close: 'scrapers.persons.session.close'
    }
  },
  companies: {
    kind: 'companies',
    methods: {
      search: 'scrapers.companies.search',
      resolve: 'scrapers.companies.resolve',
      open: 'scrapers.companies.session.open',
      get: 'scrapers.companies.session.get',
      close: 'scrapers.companies.session.close'
    }
  },
  characters: {
    kind: 'characters',
    methods: {
      search: 'scrapers.characters.search',
      resolve: 'scrapers.characters.resolve',
      open: 'scrapers.characters.session.open',
      get: 'scrapers.characters.session.get',
      close: 'scrapers.characters.session.close'
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
      register: 'bridge.scrapers.games.register',
      unregister: 'bridge.scrapers.games.unregister'
    }
  },
  persons: {
    kind: 'persons',
    slots: PERSON_SCRAPER_SLOTS,
    methods: {
      register: 'bridge.scrapers.persons.register',
      unregister: 'bridge.scrapers.persons.unregister'
    }
  },
  companies: {
    kind: 'companies',
    slots: COMPANY_SCRAPER_SLOTS,
    methods: {
      register: 'bridge.scrapers.companies.register',
      unregister: 'bridge.scrapers.companies.unregister'
    }
  },
  characters: {
    kind: 'characters',
    slots: CHARACTER_SCRAPER_SLOTS,
    methods: {
      register: 'bridge.scrapers.characters.register',
      unregister: 'bridge.scrapers.characters.unregister'
    }
  }
} as const satisfies {
  [K in ScraperRpcKind]: HostToMainScraperRpcDescriptor<K>
}

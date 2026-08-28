import { randomBytes } from 'node:crypto'

/**
 * PKCE material for MAL's authorization code flow.
 *
 * MAL only supports the `plain` challenge method, so the challenge is the
 * verifier itself; the verifier still binds the callback to this app run.
 */
export interface PkceLogin {
  state: string
  codeVerifier: string
}

export function createPkceLogin(): PkceLogin {
  return {
    state: randomToken(24),
    // 96 random bytes encode to 128 base64url chars, the PKCE maximum.
    codeVerifier: randomToken(96)
  }
}

export function buildAuthorizeUrl(input: {
  authorizeUrl: string
  clientId: string
  redirectUri: string
  state: string
  codeVerifier: string
}): string {
  const url = new URL(input.authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('state', input.state)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('code_challenge', input.codeVerifier)
  url.searchParams.set('code_challenge_method', 'plain')
  return url.toString()
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url')
}

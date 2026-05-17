const DEVELOPER_ID = 'ximu3'
const APPLICATION_NAME = 'Kisaki-Bangumi'
const HOMEPAGE = 'https://github.com/ximu3/kisaki'

export function createBangumiUserAgent(extensionVersion: string): string {
  const version = extensionVersion.trim() || '0.0.0'
  return `${DEVELOPER_ID}/${APPLICATION_NAME}/${version} (${HOMEPAGE})`
}


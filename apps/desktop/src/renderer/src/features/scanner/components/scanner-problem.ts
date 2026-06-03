import type { ScannerRunIssue, ScannerRunIssueType } from '@shared/scanner'

export interface ScannerIssueRow {
  scannerId: string
  scannerName: string
  issue: ScannerRunIssue
  existingGameName?: string
}

export type ScannerFixTarget = ScannerRunIssue & {
  scannerId?: string
  scannerName?: string
}

export function getIssueTypeText(type: ScannerRunIssueType): string {
  switch (type) {
    case 'asset-persist-failed':
      return '资源保存失败'
    case 'duplicate-external-id':
      return '外部 ID 重复'
    case 'metadata-missing':
      return '元数据缺失'
    case 'path-unavailable':
      return '路径不可访问'
    case 'scraper-unavailable':
      return '刮削不可用'
    case 'unexpected-error':
      return '意外错误'
    case 'unsupported-entry':
      return '不支持的条目'
    default:
      return type
  }
}

export function getIssueIcon(type: ScannerRunIssueType): string {
  switch (type) {
    case 'asset-persist-failed':
      return 'icon-[mdi--image-broken-variant]'
    case 'metadata-missing':
      return 'icon-[mdi--database-off-outline]'
    case 'duplicate-external-id':
      return 'icon-[mdi--link-variant]'
    case 'path-unavailable':
      return 'icon-[mdi--folder-alert-outline]'
    case 'scraper-unavailable':
      return 'icon-[mdi--cloud-off-outline]'
    case 'unexpected-error':
      return 'icon-[mdi--alert-circle-outline]'
    case 'unsupported-entry':
      return 'icon-[mdi--file-question-outline]'
    default:
      return 'icon-[mdi--alert-outline]'
  }
}

export function toIssueFixTarget(row: ScannerIssueRow): ScannerFixTarget {
  return {
    ...row.issue,
    scannerId: row.scannerId,
    scannerName: row.scannerName
  }
}

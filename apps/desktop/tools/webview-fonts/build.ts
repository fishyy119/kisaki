import { appendFile, cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  EXTENSION_WEBVIEW_FONT_PACKAGES,
  type ExtensionWebviewFontPackage
} from '../../src/shared/extension/webview-fonts'
import { resolveWebviewFontPackageRoot, type WebviewFontToolContext } from './paths'

const FONT_FILE_REFERENCE_PATTERN = /url\(\s*['"]?(\.\/files\/[^'")]+\.woff2)['"]?\s*\)/g

/** Builds the stable Electron resources consumed by kisaki-webview-font://. */
export async function buildWebviewFonts(context: WebviewFontToolContext): Promise<void> {
  await rm(context.resourceRoot, { recursive: true, force: true })
  await mkdir(context.resourceRoot, { recursive: true })

  for (const pkg of EXTENSION_WEBVIEW_FONT_PACKAGES) {
    await buildFontPackage(context, pkg)
  }

  console.log(`[webview-fonts] Prepared ${EXTENSION_WEBVIEW_FONT_PACKAGES.length} font package(s)`)
}

async function buildFontPackage(
  context: WebviewFontToolContext,
  pkg: ExtensionWebviewFontPackage
): Promise<void> {
  const sourceRoot = resolveWebviewFontPackageRoot(context, pkg)
  const targetRoot = path.join(context.resourceRoot, pkg.dir)

  await mkdir(targetRoot, { recursive: true })
  await copyRequiredFile(
    path.join(sourceRoot, pkg.stylesheet),
    path.join(targetRoot, pkg.stylesheet)
  )
  if (pkg.overrides) {
    const overrides = await readFile(path.join(context.desktopRoot, pkg.overrides), 'utf8')
    // Renderer CSS resolves npm URLs; served webview CSS uses package-relative URLs.
    await appendFile(
      path.join(targetRoot, pkg.stylesheet),
      `\n${overrides.replaceAll(`${pkg.npmPackage}/`, './')}`
    )
  }
  await copyRequiredFile(path.join(sourceRoot, 'LICENSE'), path.join(targetRoot, 'LICENSE'))
  await cp(path.join(sourceRoot, 'files'), path.join(targetRoot, 'files'), { recursive: true })
  await validateFontPackage(targetRoot, pkg.stylesheet)
}

async function copyRequiredFile(sourcePath: string, targetPath: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await cp(sourcePath, targetPath)
}

async function validateFontPackage(root: string, stylesheet: string): Promise<void> {
  const stylesheetPath = path.join(root, stylesheet)
  const stylesheetContent = await readFile(stylesheetPath, 'utf8')
  const referencedFiles = new Set(
    [...stylesheetContent.matchAll(FONT_FILE_REFERENCE_PATTERN)].map((match) => match[1])
  )

  if (referencedFiles.size === 0) {
    throw new Error(`Webview font stylesheet has no woff2 references: ${stylesheetPath}`)
  }

  for (const referencedFile of referencedFiles) {
    await stat(path.resolve(root, referencedFile!))
  }

  const files = await readdir(path.join(root, 'files'))
  if (!files.some((file) => file.endsWith('.woff2'))) {
    throw new Error(`Webview font package has no woff2 files: ${root}`)
  }
}

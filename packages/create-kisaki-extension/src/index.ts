import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prompts from 'prompts'
import { bold, cyan, dim, green, red } from 'kolorist'

const packageDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const templateDir = path.resolve(packageDir, 'templates/default')

interface ExtensionScaffoldConfig {
  projectName: string
  packageName: string
  extensionId: string
  extensionName: string
  description: string
  author: string
  category: string
}

interface ScaffoldOptions {
  git: boolean
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

async function main(): Promise<void> {
  const { projectName, options } = parseArgs(process.argv.slice(2))

  console.log()
  console.log(bold(cyan('  create-kisaki-extension')))
  console.log(dim('  Scaffolding a new Kisaki extension project.'))
  console.log()

  const response = await prompts(
    [
      {
        type: projectName ? null : 'text',
        name: 'projectName',
        message: 'Project name:',
        initial: 'my-kisaki-extension',
        validate: (value: string) =>
          isProjectName(value) ? true : 'Use letters, numbers, dots, underscores, or hyphens.'
      },
      {
        type: 'text',
        name: 'extensionId',
        message: 'Extension ID:',
        initial: (previous: string) =>
          toExtensionId(projectName || previous || 'my-kisaki-extension'),
        validate: (value: string) =>
          /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value)
            ? true
            : 'Use lowercase letters, numbers, dots, and hyphens.'
      },
      {
        type: 'text',
        name: 'extensionName',
        message: 'Display name:',
        initial: (_previous: string, values: { extensionId?: string }) =>
          toDisplayName(projectName || values.extensionId || 'my-kisaki-extension')
      },
      {
        type: 'select',
        name: 'category',
        message: 'Category:',
        initial: 0,
        choices: [
          { title: 'tool', value: 'tool' },
          { title: 'scraper', value: 'scraper' },
          { title: 'theme', value: 'theme' },
          { title: 'integration', value: 'integration' }
        ]
      },
      {
        type: 'text',
        name: 'description',
        message: 'Description:',
        initial: 'A Kisaki extension.'
      },
      {
        type: 'text',
        name: 'author',
        message: 'Author:'
      },
      {
        type: options.git === null ? 'confirm' : null,
        name: 'git',
        message: 'Initialize git repository?',
        initial: true
      }
    ],
    {
      onCancel: () => {
        console.log(red('[error]') + ' Operation cancelled.')
        process.exit(1)
      }
    }
  )

  const finalProjectName = projectName || response.projectName
  if (!isProjectName(finalProjectName)) {
    console.log(red('[error]') + ' Invalid project name.')
    process.exit(1)
  }

  const config: ExtensionScaffoldConfig = {
    projectName: finalProjectName,
    packageName: toPackageName(finalProjectName),
    extensionId: response.extensionId,
    extensionName: response.extensionName,
    description: response.description || 'A Kisaki extension.',
    author: response.author || '',
    category: response.category || 'tool'
  }
  const scaffoldOptions: ScaffoldOptions = {
    git: options.git ?? response.git ?? true
  }

  const targetDir = path.resolve(process.cwd(), config.projectName)
  if (existsSync(targetDir)) {
    console.log(red('[error]') + ` Directory already exists: ${config.projectName}`)
    process.exit(1)
  }

  mkdirSync(targetDir, { recursive: true })
  copyTemplate(templateDir, targetDir, config)

  if (scaffoldOptions.git) {
    initGit(targetDir, config.extensionName)
  }

  console.log()
  console.log(green('[ok]') + ` Created ${bold(config.projectName)}`)
  console.log()
  console.log('  Next steps:')
  console.log(`  ${dim('$')} cd ${config.projectName}`)
  console.log(`  ${dim('$')} npm install`)
  console.log(`  ${dim('$')} npm run pack`)
  console.log()
}

function parseArgs(args: string[]): { projectName?: string; options: { git: boolean | null } } {
  let projectName: string | undefined
  let git: boolean | null = null

  for (const arg of args) {
    if (arg === '--git') {
      git = true
      continue
    }
    if (arg === '--no-git') {
      git = false
      continue
    }
    if (!projectName) {
      projectName = arg
    }
  }

  return { projectName, options: { git } }
}

function copyTemplate(src: string, dest: string, config: ExtensionScaffoldConfig): void {
  if (!existsSync(src)) {
    console.log(red('[error]') + ` Template directory not found: ${src}`)
    process.exit(1)
  }

  mkdirSync(dest, { recursive: true })

  for (const entry of readdirSync(src)) {
    const sourcePath = path.join(src, entry)
    const targetPath = path.join(dest, entry)

    if (statSync(sourcePath).isDirectory()) {
      copyTemplate(sourcePath, targetPath, config)
      continue
    }

    const content = applyTemplate(readFileSync(sourcePath, 'utf-8'), config)
    writeFileSync(targetPath, content)
  }
}

function applyTemplate(content: string, config: ExtensionScaffoldConfig): string {
  return content
    .replaceAll('__PROJECT_NAME__', config.projectName)
    .replaceAll('__PACKAGE_NAME__', config.packageName)
    .replaceAll('__EXTENSION_ID__', config.extensionId)
    .replaceAll('__EXTENSION_NAME__', config.extensionName)
    .replaceAll('__DESCRIPTION__', config.description)
    .replaceAll('__AUTHOR__', config.author)
    .replaceAll('__CATEGORY__', config.category)
}

function initGit(targetDir: string, extensionName: string): void {
  try {
    execFileSync('git', ['init'], { cwd: targetDir, stdio: 'ignore' })
    execFileSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', `Initial commit: ${extensionName}`], {
      cwd: targetDir,
      stdio: 'ignore'
    })
    console.log(green('[ok]') + ' Initialized git repository.')
  } catch {
    console.log(dim('  git init skipped.'))
  }
}

function isProjectName(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value.trim())
}

function toPackageName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^[._]+/, '')
    .toLowerCase()
}

function toExtensionId(value: string): string {
  return toPackageName(value).replace(/_/g, '-')
}

function toDisplayName(value: string): string {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

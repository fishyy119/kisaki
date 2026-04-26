import path from 'node:path'
import {
  EXTENSION_CATEGORIES,
  isExtensionIdentifier,
  type ExtensionCategory
} from '@kisaki/extension-api'
import prompts from 'prompts'
import { bold, cyan, dim, green, red } from 'kolorist'
import {
  type ExtensionScaffoldConfig,
  scaffoldExtension,
  isProjectName,
  toDisplayName,
  toExtensionId,
  toPackageName
} from './scaffold'

interface CliOptions {
  templateDir: string
}

interface ParsedArgs {
  projectName?: string
  options: {
    git: boolean | null
  }
}

const DEFAULT_EXTENSION_CATEGORY: ExtensionCategory = 'tool'

export async function runCreateExtensionCli(
  argv: readonly string[],
  options: CliOptions
): Promise<void> {
  const parsed = parseArgs(argv.slice(2))

  console.log()
  console.log(bold(cyan('  create-kisaki-extension')))
  console.log(dim('  Scaffolding a new Kisaki extension project.'))
  console.log()

  const response = await prompts(
    [
      {
        type: parsed.projectName ? null : 'text',
        name: 'projectName',
        message: 'Project name:',
        initial: 'my-kisaki-extension',
        validate: (value: string) =>
          isProjectName(value)
            ? true
            : 'Use letters or numbers at both ends; dots, underscores, and hyphens may appear inside.'
      },
      {
        type: 'text',
        name: 'extensionId',
        message: 'Extension ID:',
        initial: (previous: string) =>
          toExtensionId(parsed.projectName || previous || 'my-kisaki-extension'),
        validate: (value: string) =>
          isExtensionIdentifier(value)
            ? true
            : 'Use lowercase alphanumeric segments separated by dots; hyphens may appear inside a segment.'
      },
      {
        type: 'text',
        name: 'extensionName',
        message: 'Display name:',
        initial: (_previous: string, values: { extensionId?: string }) =>
          toDisplayName(parsed.projectName || values.extensionId || 'my-kisaki-extension')
      },
      {
        type: 'select',
        name: 'category',
        message: 'Category:',
        initial: EXTENSION_CATEGORIES.indexOf(DEFAULT_EXTENSION_CATEGORY),
        choices: EXTENSION_CATEGORIES.map((category) => ({ title: category, value: category }))
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
        type: parsed.options.git === null ? 'confirm' : null,
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

  const projectName = parsed.projectName || response.projectName
  if (!isProjectName(projectName)) {
    console.log(red('[error]') + ' Invalid project name.')
    process.exit(1)
  }

  const config: ExtensionScaffoldConfig = {
    projectName,
    packageName: toPackageName(projectName),
    extensionId: response.extensionId,
    extensionName: response.extensionName,
    description: response.description || 'A Kisaki extension.',
    author: response.author || '',
    category: response.category || DEFAULT_EXTENSION_CATEGORY
  }

  if (!isExtensionIdentifier(config.extensionId)) {
    console.log(red('[error]') + ' Invalid extension ID.')
    process.exit(1)
  }

  const result = scaffoldExtension({
    config,
    templateDir: options.templateDir,
    targetDir: path.resolve(process.cwd(), config.projectName),
    git: parsed.options.git ?? response.git ?? true
  })

  if (result.gitInitialized) {
    console.log(green('[ok]') + ' Initialized git repository.')
    if (!result.initialCommitCreated) {
      console.log(dim('  initial commit skipped.'))
    }
  } else if (result.gitRequested) {
    console.log(dim('  git initialization skipped.'))
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

function parseArgs(args: readonly string[]): ParsedArgs {
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

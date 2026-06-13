import path from 'node:path'
import {
  EXTENSION_CATEGORIES,
  EXTENSION_API_VERSION,
  getRecommendedExtensionApiRange,
  isExtensionIdentifier,
  type ExtensionCategory
} from '@kisaki3/extension-api'
import prompts from 'prompts'
import { bold, cyan, dim, green, red } from 'kolorist'
import {
  type ExtensionScaffoldConfig,
  type ExtensionPublishWorkflow,
  type ExtensionUiVariant,
  scaffoldExtension,
  isProjectName,
  toDisplayName,
  toExtensionId,
  toPackageName
} from './scaffold'

interface CliOptions {
  templateDir: string
  toolingVersion: string
}

interface ParsedArgs {
  projectName?: string
  options: {
    git: boolean | null
    publishWorkflow: ExtensionPublishWorkflow | null
  }
}

type PromptQuestion = prompts.PromptObject

const DEFAULT_EXTENSION_CATEGORY: ExtensionCategory = 'tool'
const DEFAULT_PUBLISH_WORKFLOW: ExtensionPublishWorkflow = 'github-single'

export async function runCreateExtensionCli(
  argv: readonly string[],
  options: CliOptions
): Promise<void> {
  const parsed = parseArgs(argv.slice(2))

  console.log()
  console.log(bold(cyan('  create-kisaki-extension')))
  console.log(dim('  Scaffolding a new Kisaki extension project.'))
  console.log()

  const response = await prompts(createPromptQuestions(parsed), {
    onCancel: () => {
      console.log(red('[error]') + ' Operation cancelled.')
      process.exit(1)
    }
  })

  const projectName = parsed.projectName || response.projectName
  if (!isProjectName(projectName)) {
    console.log(red('[error]') + ' Invalid project name.')
    process.exit(1)
  }

  const extensionName =
    typeof response.extensionName === 'string' && response.extensionName.trim().length > 0
      ? response.extensionName.trim()
      : toDisplayName(projectName)

  const config: ExtensionScaffoldConfig = {
    projectName,
    packageName: toPackageName(projectName),
    extensionId: response.extensionId,
    extensionName,
    description: response.description || 'A Kisaki extension.',
    author: response.author || '',
    category: response.category || DEFAULT_EXTENSION_CATEGORY,
    uiVariant: (response.uiVariant as ExtensionUiVariant | undefined) ?? 'none',
    toolingVersion: options.toolingVersion,
    extensionApiRange: getRecommendedExtensionApiRange(EXTENSION_API_VERSION),
    publishWorkflow:
      parsed.options.publishWorkflow ?? response.publishWorkflow ?? DEFAULT_PUBLISH_WORKFLOW,
    registryId: response.registryId || toExtensionId(`${response.extensionId}.registry`),
    registryName: response.registryName || `${extensionName} Extensions`
  }

  if (!isExtensionIdentifier(config.extensionId)) {
    console.log(red('[error]') + ' Invalid extension ID.')
    process.exit(1)
  }

  if (!isExtensionIdentifier(config.registryId)) {
    console.log(red('[error]') + ' Invalid registry ID.')
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
  if (config.publishWorkflow === 'github-monorepo') {
    console.log(`  ${dim('$')} cd extensions/${config.extensionId}`)
    console.log(`  ${dim('$')} npm install`)
    console.log(`  ${dim('$')} cd ../..`)
    console.log(`  ${dim('$')} git remote add origin <your-github-repo>`)
    console.log(`  ${dim('$')} git push -u origin main`)
    console.log(
      `  ${dim('$')} git commit --allow-empty -m "release(${config.extensionId}): v0.0.1"`
    )
    console.log(`  ${dim('$')} git push`)
  } else if (config.publishWorkflow === 'github-single') {
    console.log(`  ${dim('$')} npm install`)
    console.log(`  ${dim('$')} git remote add origin <your-github-repo>`)
    console.log(`  ${dim('$')} git push -u origin main`)
    console.log(`  ${dim('$')} git commit --allow-empty -m "release: v0.0.1"`)
    console.log(`  ${dim('$')} git push`)
  } else {
    console.log(`  ${dim('$')} npm install`)
    console.log(`  ${dim('$')} npm run pack`)
  }
  console.log()
}

function createPromptQuestions(parsed: ParsedArgs): PromptQuestion[] {
  const questions: PromptQuestion[] = []

  if (!parsed.projectName) {
    questions.push({
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-kisaki-extension',
      validate: (value: string) =>
        isProjectName(value)
          ? true
          : 'Use letters or numbers at both ends; dots, underscores, and hyphens may appear inside.'
    })
  }

  questions.push(
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
        toDisplayName(parsed.projectName || values.extensionId || 'my-kisaki-extension'),
      validate: (value: string) => (value.trim().length > 0 ? true : 'Display name is required.')
    },
    {
      type: 'select',
      name: 'category',
      message: 'Category:',
      initial: EXTENSION_CATEGORIES.indexOf(DEFAULT_EXTENSION_CATEGORY),
      choices: EXTENSION_CATEGORIES.map((category) => ({ title: category, value: category }))
    },
    {
      type: (_previous: unknown, values: { category?: ExtensionCategory }) =>
        values.category === 'tool' ? 'select' : null,
      name: 'uiVariant',
      message: 'Webview UI:',
      initial: 0,
      choices: [
        {
          title: 'Vue + Kisaki UI Kit',
          value: 'vue-kit',
          description: 'Vue with @kisaki3/extension-ui-vue components matching the app design.'
        },
        {
          title: 'Vue',
          value: 'vue',
          description: 'Vue single-file-component webview app, plain Tailwind.'
        },
        {
          title: 'Vanilla TypeScript',
          value: 'vanilla',
          description: 'Plain DOM webview document with minimal dependencies.'
        }
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
    }
  )

  if (parsed.options.publishWorkflow === null) {
    questions.push({
      type: 'select',
      name: 'publishWorkflow',
      message: 'Publish workflow:',
      initial: 0,
      choices: [
        {
          title: 'GitHub single extension',
          value: 'github-single',
          description: 'Root manifest; release commits create GitHub Releases and registry updates.'
        },
        {
          title: 'GitHub extension monorepo',
          value: 'github-monorepo',
          description: 'extensions/<id>; scoped release commits update one shared registry.'
        },
        {
          title: 'Manual or custom hosting',
          value: 'manual',
          description: 'Keep only local packaging and registry commands.'
        }
      ]
    })
  }

  questions.push(
    {
      type: 'text',
      name: 'registryId',
      message: 'Registry ID:',
      initial: (_previous: string, values: { extensionId?: string }) =>
        toExtensionId(`${values.extensionId || 'my-kisaki-extension'}.registry`),
      validate: (value: string) =>
        isExtensionIdentifier(value)
          ? true
          : 'Use lowercase alphanumeric segments separated by dots; hyphens may appear inside a segment.'
    },
    {
      type: 'text',
      name: 'registryName',
      message: 'Registry name:',
      initial: (_previous: string, values: { extensionName?: string }) =>
        `${values.extensionName || 'Kisaki'} Extensions`
    }
  )

  if (parsed.options.git === null) {
    questions.push({
      type: 'confirm',
      name: 'git',
      message: 'Initialize git repository?',
      initial: true
    })
  }

  return questions
}

function parseArgs(args: readonly string[]): ParsedArgs {
  let projectName: string | undefined
  let git: boolean | null = null
  let publishWorkflow: ExtensionPublishWorkflow | null = null

  for (const arg of args) {
    if (arg === '--git') {
      git = true
      continue
    }

    if (arg === '--no-git') {
      git = false
      continue
    }

    if (arg === '--github-single') {
      publishWorkflow = 'github-single'
      continue
    }

    if (arg === '--github-monorepo') {
      publishWorkflow = 'github-monorepo'
      continue
    }

    if (arg === '--manual') {
      publishWorkflow = 'manual'
      continue
    }

    if (!projectName) {
      projectName = arg
    }
  }

  return {
    ...(projectName === undefined ? {} : { projectName }),
    options: { git, publishWorkflow }
  }
}

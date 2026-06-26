import { cancel, confirm, multiselect, select, text, type Option } from '@clack/prompts'
import { ScaffoldCancelledError } from '../../errors'

/** A selectable option shown by a prompt. */
export interface PromptChoice<T extends string> {
  value: T
  label: string
  selected?: boolean
}

export interface TextPromptOptions {
  message: string
  initial: string
  validate?: (value: string) => boolean | string
}

export interface SelectPromptOptions<T extends string> {
  message: string
  initial: T
  choices: readonly PromptChoice<T>[]
}

export interface MultiSelectPromptOptions<T extends string> {
  message: string
  choices: readonly PromptChoice<T>[]
}

export interface ConfirmPromptOptions {
  message: string
  initial: boolean
}

/** Interactive prompt surface used by scaffold actions and the wizard. */
export interface ScaffoldPromptUi {
  text(options: TextPromptOptions): Promise<string>
  select<T extends string>(options: SelectPromptOptions<T>): Promise<T>
  multiSelect<T extends string>(options: MultiSelectPromptOptions<T>): Promise<readonly T[]>
  confirm(options: ConfirmPromptOptions): Promise<boolean>
}

/** Creates the interactive prompt facade used by scaffold actions. */
export function createPromptUi(): ScaffoldPromptUi {
  return {
    async text(options) {
      // The default is shown as a dim placeholder that vanishes on the first
      // keystroke; submitting an empty field falls back to defaultValue so the
      // caller still receives the suggested value without typing it.
      const answer = await text({
        message: options.message,
        placeholder: options.initial,
        defaultValue: options.initial,
        ...optionalValidate(options.validate)
      })
      return requireAnswer(answer, options.message)
    },

    async select<T extends string>(options: SelectPromptOptions<T>): Promise<T> {
      const answer = await select<T>({
        message: options.message,
        initialValue: options.initial,
        options: toClackOptions(options.choices)
      })
      return requireAnswer(answer, options.message)
    },

    async multiSelect<T extends string>(
      options: MultiSelectPromptOptions<T>
    ): Promise<readonly T[]> {
      const initialValues = options.choices
        .filter((choice) => choice.selected === true)
        .map((choice) => choice.value)
      const answer = await multiselect<T>({
        message: options.message,
        required: true,
        initialValues,
        options: toClackOptions(options.choices)
      })
      if (typeof answer === 'symbol') {
        cancel(`${options.message} cancelled.`)
        throw new ScaffoldCancelledError()
      }
      return answer
    },

    async confirm(options) {
      const answer = await confirm({
        message: options.message,
        initialValue: options.initial
      })
      return requireAnswer(answer, options.message)
    }
  }
}

function toClackOptions<T extends string>(choices: readonly PromptChoice<T>[]): Option<T>[] {
  // The cast bridges our PromptChoice shape to @clack's distributed conditional
  // Option<T> type, which TypeScript cannot resolve while T is still generic.
  return choices.map((choice) => ({ value: choice.value, label: choice.label })) as Option<T>[]
}

/**
 * Adapts a boolean|string validator to @clack's string|undefined contract so
 * callers keep the simpler "true passes, string explains the failure" shape.
 * Returns a spreadable fragment so the optional `validate` field is omitted
 * entirely when no validator is supplied (required by exactOptionalPropertyTypes).
 */
function optionalValidate(validate?: (value: string) => boolean | string): {
  validate: (value: string | undefined) => string | undefined
} {
  return {
    validate: (value) => {
      if (!validate || value === undefined) {
        return undefined
      }
      const result = validate(value)
      return typeof result === 'string' ? result : undefined
    }
  }
}

/** Unwraps a @clack answer, throwing a cancellation error on the cancel symbol. */
function requireAnswer<T>(answer: symbol | T, message: string): T {
  if (typeof answer === 'symbol') {
    cancel(`${message} cancelled.`)
    throw new ScaffoldCancelledError()
  }
  return answer
}

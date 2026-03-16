declare module 'turndown' {
  export type TurndownPlugin = (service: TurndownService) => void
  export type TurndownRule = {
    filter: string | ((node: HTMLElement) => boolean)
    replacement: (content: string, node: HTMLElement) => string
  }

  export default class TurndownService {
    constructor(options?: {
      codeBlockStyle?: string
      headingStyle?: string
    })
    escape: (value: string) => string
    use(plugin: TurndownPlugin): void
    addRule(key: string, rule: TurndownRule): void
    turndown(html: string): string
  }
}

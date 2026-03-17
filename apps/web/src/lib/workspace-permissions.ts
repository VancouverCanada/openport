import type {
  OpenPortCurrentUserResponse,
  OpenPortWorkspaceModuleCapabilities,
  OpenPortWorkspaceModulePermissions,
  OpenPortWorkspaceResourceCapabilities
} from '@openport/product-contracts'

export type WorkspaceModuleKey = keyof OpenPortWorkspaceModulePermissions
export type WorkspaceModuleAction = keyof OpenPortWorkspaceModuleCapabilities

export const primaryWorkspaceTabs: Array<{
  href: string
  label: string
  module: WorkspaceModuleKey
}> = [
  { href: '/workspace', label: 'Models', module: 'models' },
  { href: '/workspace/knowledge', label: 'Knowledge', module: 'knowledge' },
  { href: '/workspace/prompts', label: 'Prompts', module: 'prompts' },
  { href: '/workspace/tools', label: 'Tools', module: 'tools' },
  { href: '/workspace/skills', label: 'Skills', module: 'skills' }
]

const moduleRouteMap: Array<{ prefix: string; module: WorkspaceModuleKey }> = [
  { prefix: '/workspace/models', module: 'models' },
  { prefix: '/workspace/knowledge', module: 'knowledge' },
  { prefix: '/workspace/prompts', module: 'prompts' },
  { prefix: '/workspace/tools', module: 'tools' },
  { prefix: '/workspace/skills', module: 'skills' },
  { prefix: '/workspace', module: 'models' }
]

export function getWorkspacePermissions(user: OpenPortCurrentUserResponse | null): OpenPortWorkspaceModulePermissions {
  return (
    user?.permissions?.workspace ?? {
      models: false,
      knowledge: false,
      prompts: false,
      tools: false,
      skills: false
    }
  )
}

function emptyModuleCapabilities(): OpenPortWorkspaceModuleCapabilities {
  return {
    read: false,
    manage: false,
    import: false,
    export: false,
    publish: false,
    share: false,
    validate: false
  }
}

export function getWorkspaceCapabilities(user: OpenPortCurrentUserResponse | null): OpenPortWorkspaceResourceCapabilities {
  return (
    user?.permissions?.workspaceCapabilities ?? {
      models: emptyModuleCapabilities(),
      knowledge: emptyModuleCapabilities(),
      prompts: emptyModuleCapabilities(),
      tools: emptyModuleCapabilities(),
      skills: emptyModuleCapabilities()
    }
  )
}

export function canManageWorkspace(user: OpenPortCurrentUserResponse | null): boolean {
  const capabilities = getWorkspaceCapabilities(user)
  return Object.values(capabilities).some((moduleCapabilities) => moduleCapabilities.manage)
}

export function canManageWorkspaceModule(
  user: OpenPortCurrentUserResponse | null,
  module: WorkspaceModuleKey
): boolean {
  return canWorkspaceModuleAction(user, module, 'manage')
}

export function canWorkspaceModuleAction(
  user: OpenPortCurrentUserResponse | null,
  module: WorkspaceModuleKey,
  action: WorkspaceModuleAction
): boolean {
  const capabilities = getWorkspaceCapabilities(user)
  return Boolean(capabilities[module]?.[action])
}

export function canAccessWorkspaceModule(
  permissions: OpenPortWorkspaceModulePermissions,
  module: WorkspaceModuleKey | null
): boolean {
  if (!module) return true
  return Boolean(permissions[module])
}

export function getWorkspaceModuleForPathname(pathname: string): WorkspaceModuleKey | null {
  const match = moduleRouteMap.find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))
  return match?.module ?? null
}

export function getFirstAccessibleWorkspaceHref(permissions: OpenPortWorkspaceModulePermissions): string {
  const firstPrimary = primaryWorkspaceTabs.find((tab) => permissions[tab.module])
  if (firstPrimary) {
    return firstPrimary.href
  }

  return '/'
}

const manageRoutePatterns = [
  /^\/workspace\/models\/create$/,
  /^\/workspace\/models\/[^/]+$/,
  /^\/workspace\/prompts\/create$/,
  /^\/workspace\/prompts\/[^/]+$/,
  /^\/workspace\/tools\/create$/,
  /^\/workspace\/tools\/[^/]+$/,
  /^\/workspace\/skills\/create$/,
  /^\/workspace\/skills\/[^/]+$/,
  /^\/workspace\/knowledge\/create$/,
  /^\/workspace\/knowledge\/collections\/create$/,
  /^\/workspace\/knowledge\/collections\/[^/]+\/edit$/,
  /^\/workspace\/functions\/create$/
]

export function isWorkspaceManagePath(pathname: string): boolean {
  return manageRoutePatterns.some((pattern) => pattern.test(pathname))
}

import { Injectable } from '@nestjs/common'
import type {
  OpenPortRoleAssignmentsResponse,
  OpenPortRoleScope,
  OpenPortRoleTemplate,
  OpenPortRoleTemplatesResponse
} from '@openport/product-contracts'

const ROLE_TEMPLATES: Record<OpenPortRoleScope, OpenPortRoleTemplate[]> = {
  workspace: [
    { id: 'workspace_owner', name: 'Workspace Owner', capabilities: ['workspace.manage', 'member.manage', 'billing.read'] },
    { id: 'workspace_admin', name: 'Workspace Admin', capabilities: ['workspace.manage', 'member.manage'] },
    { id: 'workspace_member', name: 'Workspace Member', capabilities: ['workspace.read', 'chat.use', 'integration.read'] },
    { id: 'workspace_viewer', name: 'Workspace Viewer', capabilities: ['workspace.read'] }
  ],
  integrations: [
    { id: 'integration_admin', name: 'Integration Admin', capabilities: ['integration.manage', 'integration.keys.manage', 'audit.read'] },
    { id: 'integration_operator', name: 'Integration Operator', capabilities: ['integration.read', 'draft.approve'] }
  ]
}

@Injectable()
export class RbacService {
  listTemplates(scope: string): OpenPortRoleTemplatesResponse {
    const normalized = scope === 'integrations' ? 'integrations' : 'workspace'
    return {
      scope: normalized,
      items: ROLE_TEMPLATES[normalized]
    }
  }

  getAssignments(userId: string, workspaceId: string): OpenPortRoleAssignmentsResponse {
    return {
      userId,
      workspaceId,
      assignments: [
        {
          scope: 'workspace',
          roleTemplateId: 'workspace_owner',
          inherited: false
        }
      ]
    }
  }
}

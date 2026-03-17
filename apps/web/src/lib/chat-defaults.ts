'use client'

import type { OpenPortChatSettings, OpenPortWorkspaceModel } from '@openport/product-contracts'
import type { OpenPortProject } from './chat-workspace'
import type { OpenPortChatUiPreferences } from './chat-ui-preferences'
import { getProjectPrimaryModelRoute } from './chat-workspace'

export type ChatSettingSource = 'chat' | 'project' | 'interface' | 'workspace' | 'runtime'

export function getWorkspaceDefaultModelRoute(models: OpenPortWorkspaceModel[]): string | null {
  return models.find((model) => model.isDefault)?.route || null
}

export function getInheritedChatSettings(
  baseSettings: OpenPortChatSettings,
  project: OpenPortProject | null,
  preferences: OpenPortChatUiPreferences,
  models: OpenPortWorkspaceModel[]
): OpenPortChatSettings {
  const workspaceDefaultModelRoute = getWorkspaceDefaultModelRoute(models)
  const interfaceDefaults = preferences.chatDefaults

  return {
    ...baseSettings,
    systemPrompt: project?.data.systemPrompt || interfaceDefaults.systemPrompt || baseSettings.systemPrompt,
    valves: {
      ...baseSettings.valves,
      modelRoute:
        getProjectPrimaryModelRoute(project) ||
        interfaceDefaults.modelRoute ||
        workspaceDefaultModelRoute ||
        baseSettings.valves.modelRoute,
      operatorMode: interfaceDefaults.operatorMode || baseSettings.valves.operatorMode,
      functionCalling: interfaceDefaults.functionCalling
    },
    params: {
      ...baseSettings.params,
      streamResponse: interfaceDefaults.streamResponse,
      reasoningEffort: interfaceDefaults.reasoningEffort,
      temperature: interfaceDefaults.temperature,
      maxTokens: interfaceDefaults.maxTokens,
      topP: interfaceDefaults.topP
    }
  }
}

export function getModelRouteSource(
  route: string,
  project: OpenPortProject | null,
  preferences: OpenPortChatUiPreferences,
  models: OpenPortWorkspaceModel[]
): ChatSettingSource {
  const workspaceDefaultRoute = getWorkspaceDefaultModelRoute(models)
  const projectRoute = getProjectPrimaryModelRoute(project)
  if (route === (projectRoute || null)) return 'project'
  if (route === (preferences.chatDefaults.modelRoute || null)) return 'interface'
  if (route === workspaceDefaultRoute) return 'workspace'
  if (route === 'openport/local') return 'runtime'
  return 'chat'
}

export function getSystemPromptSource(
  prompt: string,
  project: OpenPortProject | null,
  preferences: OpenPortChatUiPreferences
): ChatSettingSource {
  if (prompt === (project?.data.systemPrompt || '') && prompt) return 'project'
  if (prompt === preferences.chatDefaults.systemPrompt && prompt) return 'interface'
  return prompt ? 'chat' : 'runtime'
}

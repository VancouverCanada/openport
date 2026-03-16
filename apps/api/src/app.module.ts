import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AiModule } from './ai/ai.module.js'
import { AuthModule } from './auth/auth.module.js'
import { HealthModule } from './health/health.module.js'
import { GroupsModule } from './groups/groups.module.js'
import { NotesModule } from './notes/notes.module.js'
import { OpenPortAdminModule } from './openport-admin/openport-admin.module.js'
import { OpenPortModule } from './openport/openport.module.js'
import { ProjectsModule } from './projects/projects.module.js'
import { RbacModule } from './rbac/rbac.module.js'
import { SearchModule } from './search/search.module.js'
import { WorkspaceResourcesModule } from './workspace-resources/workspace-resources.module.js'
import { WorkspacesModule } from './workspaces/workspaces.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'].filter(Boolean)
    }),
    HealthModule,
    OpenPortModule,
    AuthModule,
    WorkspacesModule,
    GroupsModule,
    RbacModule,
    OpenPortAdminModule,
    AiModule,
    ProjectsModule,
    NotesModule,
    SearchModule,
    WorkspaceResourcesModule
  ]
})
export class AppModule {}

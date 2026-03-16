import { Body, Controller, Get, Headers, Post } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RefreshDto } from './dto/refresh.dto.js'
import { RegisterDto } from './dto/register.dto.js'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Record<string, unknown> {
    return this.auth.register(dto)
  }

  @Post('login')
  login(@Body() dto: LoginDto): Record<string, unknown> {
    return this.auth.login(dto)
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Record<string, unknown> {
    return this.auth.refresh(dto)
  }

  @Post('logout')
  logout(@Body('refreshToken') refreshToken?: string): { ok: true } {
    return this.auth.logout(refreshToken || null)
  }

  @Get('me')
  me(@Headers() headers: Record<string, unknown>): Record<string, unknown> {
    return this.auth.getCurrentUser(headers)
  }
}

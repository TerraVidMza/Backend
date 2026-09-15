import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from '../usuarios/dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AnyRole } from '../../common/decorators/any-role.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth y seguridad')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 10 intentos por minuto y por IP: complementa el bloqueo por cuenta, que no
  // frena un ataque distribuido sobre muchos emails distintos.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @AnyRole()
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.authService.logout(user, ip);
  }

  // HU-03 pide máximo 3 solicitudes por hora para prevenir spam de emails.
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Respuesta genérica para no filtrar existencia de la cuenta.
    return {
      message:
        'Si el email existe, se enviaron las instrucciones de recuperación.',
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Contraseña actualizada correctamente.' };
  }

  @AnyRole()
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('cambiar-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}

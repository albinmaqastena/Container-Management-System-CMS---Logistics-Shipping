import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/auth/entities/user.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
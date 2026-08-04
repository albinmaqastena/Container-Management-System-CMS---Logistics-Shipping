import type { Request } from 'express';
import { UserRole } from '../entities/user.entity';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  sid: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

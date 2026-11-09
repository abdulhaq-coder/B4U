import { Role } from '@prisma/client';

export const CLIENT_ROLES = [Role.CUSTOMER, Role.OWNER] as const; // signup / social
export const LOGIN_ROLES = [Role.CUSTOMER, Role.OWNER, Role.ADMIN] as const; // password login

import { Role } from '@prisma/client';

// Jo roles apps se signup/login kar sakte hain. Version 2 me yahan add honge.
export const CLIENT_ROLES = [Role.CUSTOMER, Role.OWNER] as const;


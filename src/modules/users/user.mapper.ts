import { User } from '@prisma/client';

export type NextStep = 'COMPLETE_PROFILE' | 'HOME';

export function nextStepFor(user: Pick<User, 'profileCompletedAt'>): NextStep {
  return user.profileCompletedAt ? 'HOME' : 'COMPLETE_PROFILE';
}

/** Client ko sirf ye fields jayengi (passwordHash wagera kabhi nahi). */
export function toPublicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : null,
    phone: u.phone,
    gender: u.gender,
    countryCode: u.countryCode,
    cityId: u.cityId,
    profileCompleted: !!u.profileCompletedAt,
  };
}

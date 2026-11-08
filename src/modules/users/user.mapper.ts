import { User } from '@prisma/client';

export type NextStep = 'SET_PASSWORD' | 'COMPLETE_PROFILE' | 'HOME';
type OnboardingFields = Pick<User, 'profileCompletedAt' | 'passwordHash'>;

export function isOnboarded(u: OnboardingFields): boolean {
  return !!u.profileCompletedAt && !!u.passwordHash;
}

export function nextStepFor(u: OnboardingFields): NextStep {
  if (!u.passwordHash) return 'SET_PASSWORD';
  if (!u.profileCompletedAt) return 'COMPLETE_PROFILE';
  return 'HOME';
}

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
    hasPassword: !!u.passwordHash,
  };
}

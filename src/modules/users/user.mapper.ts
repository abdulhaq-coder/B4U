import { Role, User } from '@prisma/client';
import { mediaUrl } from '../../common/utils/media-url.util';

export type NextStep = 'SET_PASSWORD' | 'COMPLETE_PROFILE' | 'OWNER_SETUP' | 'HOME';
type OnboardingFields = Pick<User, 'role' | 'profileCompletedAt' | 'passwordHash'>;
type UserWithOptionalAvatar = User & { avatar?: { key: string } | null };

// Personal details (DOB, phone...) sirf customer se maange jate hain
const needsProfile = (role: Role) => role === Role.CUSTOMER;

export function isOnboarded(u: OnboardingFields): boolean {
  return !!u.passwordHash && (!needsProfile(u.role) || !!u.profileCompletedAt);
}

export function nextStepFor(u: OnboardingFields): NextStep {
  if (!u.passwordHash) return 'SET_PASSWORD';
  if (needsProfile(u.role) && !u.profileCompletedAt) return 'COMPLETE_PROFILE';
  return u.role === Role.OWNER ? 'OWNER_SETUP' : 'HOME';
}

export function toPublicUser(u: UserWithOptionalAvatar) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    avatarUrl: u.avatar ? mediaUrl(u.avatar.key) : null,
    dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : null,
    phone: u.phone,
    gender: u.gender,
    countryCode: u.countryCode,
    cityId: u.cityId,
    profileCompleted: !!u.profileCompletedAt,
    hasPassword: !!u.passwordHash,
  };
}

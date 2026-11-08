import { SetMetadata } from '@nestjs/common';

export const ALLOW_INCOMPLETE_PROFILE_KEY = 'allowIncompleteProfile';
/** Is route pe profile adhoori ho tab bhi access milega. */
export const AllowIncompleteProfile = () => SetMetadata(ALLOW_INCOMPLETE_PROFILE_KEY, true);


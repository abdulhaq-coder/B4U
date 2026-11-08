import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit() {
    this.dummyHash = await this.hash(randomBytes(16).toString('hex'));
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** User na mile tab bhi same time lagta hai, taake timing se email ka pata na chale. */
  async verifyDummy(plain: string): Promise<void> {
    await this.verify(this.dummyHash, plain);
  }
}

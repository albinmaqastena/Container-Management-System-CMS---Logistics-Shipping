// src/scripts/generate-hash.ts

import * as argon2 from 'argon2';

export async function generateHash(): Promise<void> {
  const password = process.argv[2] || 'Password@123';

  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 4096,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });

  console.log('========================================');
  console.log('🔐 Argon2 Hash Generator');
  console.log('========================================');
  console.log(`📝 Password: ${password}`);
  console.log(`🔑 Hash: ${hash}`);
  console.log('========================================');
  console.log('✅ Konfigurimi:');
  console.log('   - Type: Argon2id');
  console.log('   - Memory Cost: 4096');
  console.log('   - Time Cost: 3');
  console.log('   - Parallelism: 1');
  console.log('   - Salt Length: 16');
  console.log('   - Hash Length: 32');
  console.log('========================================');
}

if (require.main === module) {
  void generateHash().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.stack || error.message : 'Unknown error while generating hash';

    console.error(`❌ Error generating hash: ${message}`);
    process.exitCode = 1;
  });
}

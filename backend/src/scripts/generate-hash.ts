// scripts/generate-hash.ts
import * as argon2 from 'argon2';

async function generateHash() {
  // ✅ Konfigurimi i rekomanduar për Argon2
  const password = process.argv[2] || 'Admin@123';
  
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id, // ✅ Më i sigurti
      memoryCost: 4096,      // 4 MB
      timeCost: 3,           // 3 iteracione
      parallelism: 1,        // 1 thread
      hashLength: 32,        // 32 bytes hash
    });
    
    console.log('========================================');
    console.log('🔐 Argon2 Hash Generator');
    console.log('========================================');
    console.log(`📝 Password: ${password}`);
    console.log(`🔑 Hash: ${hash}`);
    console.log('========================================');
    console.log('✅ Konfigurimi:');
    console.log(`   - Type: Argon2id`);
    console.log(`   - Memory Cost: 4096`);
    console.log(`   - Time Cost: 3`);
    console.log(`   - Parallelism: 1`);
    console.log(`   - Salt Length: 16`);
    console.log(`   - Hash Length: 32`);
    console.log('========================================');
  } catch (error) {
    console.error('❌ Error generating hash:', error);
    process.exit(1);
  }
}

// ✅ Nëse ekzekutohet direkt
if (require.main === module) {
  generateHash();
}

// ✅ Eksporto për përdorim në migrime
export { generateHash };
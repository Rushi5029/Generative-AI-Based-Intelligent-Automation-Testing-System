import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateData() {
  const atlasUri = process.env.TARGET_ATLAS_URI || process.env.MONGODB_URI;

  if (!atlasUri || !atlasUri.startsWith('mongodb')) {
    console.error('❌ Error: No valid MongoDB connection string provided.');
    console.error('Usage:');
    console.error('  $env:TARGET_ATLAS_URI="mongodb+srv://user:pass@cluster.mongodb.net/ai-testing-system?retryWrites=true&w=majority"');
    console.error('  node scripts/migrate-to-atlas.js');
    process.exit(1);
  }

  // Find latest backup
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    console.error('❌ Backup directory not found.');
    process.exit(1);
  }

  const files = fs.readdirSync(backupDir).filter((f) => f.startsWith('local-backup-') && f.endsWith('.json'));
  if (files.length === 0) {
    console.error('❌ No backup files found in server/backups.');
    process.exit(1);
  }

  files.sort().reverse();
  const latestBackupFile = path.join(backupDir, files[0]);
  console.log(`📂 Using latest backup: ${files[0]}`);

  const raw = fs.readFileSync(latestBackupFile, 'utf-8');
  const backupData = JSON.parse(raw);

  const maskedUri = atlasUri.replace(/:([^:@]+)@/, ':****@');
  console.log(`🔌 Connecting to target MongoDB: ${maskedUri}...`);

  try {
    const conn = await mongoose.connect(atlasUri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('✅ Connected to target MongoDB successfully!\n');

    const db = conn.connection.db;
    console.log(`Target Database: ${db.databaseName}`);
    console.log('='.repeat(65));
    console.log(`${'Collection'.padEnd(25)} | ${'Local'.padEnd(8)} | ${'Atlas'.padEnd(8)} | Status`);
    console.log('='.repeat(65));

    const results = [];

    for (const [colName, docs] of Object.entries(backupData.collections)) {
      const localCount = docs.length;
      if (localCount === 0) {
        results.push({ name: colName, local: 0, atlas: 0, status: 'EMPTY (Skipped)' });
        console.log(`${colName.padEnd(25)} | ${String(0).padEnd(8)} | ${String(0).padEnd(8)} | ⚪ Skipped (0 docs)`);
        continue;
      }

      const collection = db.collection(colName);

      // Perform batch upsert based on _id to prevent duplicates and preserve original _id
      const batchSize = 500;
      let insertedOrUpdated = 0;

      for (let i = 0; i < docs.length; i += batchSize) {
        const chunk = docs.slice(i, i + batchSize);
        const operations = chunk.map((doc) => {
          // Convert stringified dates or ObjectIds if needed, preserving fields
          return {
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true,
            },
          };
        });

        const bulkResult = await collection.bulkWrite(operations, { ordered: false });
        insertedOrUpdated += (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
      }

      const atlasCount = await collection.countDocuments();
      const isMatch = atlasCount >= localCount;
      const statusStr = isMatch ? '✅ MATCH' : '⚠️ MISMATCH';

      results.push({ name: colName, local: localCount, atlas: atlasCount, status: statusStr });
      console.log(
        `${colName.padEnd(25)} | ${String(localCount).padEnd(8)} | ${String(atlasCount).padEnd(8)} | ${statusStr}`
      );
    }

    console.log('='.repeat(65));
    console.log('🎉 Migration run completed!');

    await mongoose.connection.close();
    console.log('Database connection closed safely.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateData();

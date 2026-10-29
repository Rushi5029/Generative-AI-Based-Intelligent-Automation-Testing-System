import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectAndBackup() {
  const localUri = 'mongodb://127.0.0.1:27017/ai-testing-system';
  console.log(`Connecting to local MongoDB: ${localUri}...`);

  try {
    const conn = await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to local MongoDB successfully!');

    // List all databases
    const adminDb = conn.connection.db.admin();
    const dbsResult = await adminDb.listDatabases();
    console.log('\n--- All Local Databases ---');
    dbsResult.databases.forEach((db) => {
      console.log(`  - ${db.name} (${Math.round(db.sizeOnDisk / 1024)} KB)`);
    });

    // Target database
    const db = conn.connection.db;
    console.log(`\n--- Inspecting Target Database: ${db.databaseName} ---`);
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);

    const inventory = [];
    const fullBackup = {
      databaseName: db.databaseName,
      backupTimestamp: new Date().toISOString(),
      collections: {},
    };

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const count = await db.collection(colName).countDocuments();
      const sample = await db.collection(colName).find({}).limit(1).toArray();
      const allDocs = await db.collection(colName).find({}).toArray();

      inventory.push({ name: colName, count, hasSample: sample.length > 0 });
      fullBackup.collections[colName] = allDocs;
      console.log(`  📁 ${colName.padEnd(25)} : ${count} documents`);
    }

    // Save full backup
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupDir, `local-backup-${timestamp}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(fullBackup, null, 2), 'utf-8');
    console.log(`\n💾 Full backup saved to: ${backupFilePath}`);
    console.log(`Total collections backed up: ${Object.keys(fullBackup.collections).length}`);

    await mongoose.connection.close();
    console.log('Database connection closed safely.');
  } catch (error) {
    console.error('❌ Failed to connect to local MongoDB:', error.message);
    process.exit(1);
  }
}

inspectAndBackup();

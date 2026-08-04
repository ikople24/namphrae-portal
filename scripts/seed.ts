/**
 * Seed the portal config into MongoDB from data/portal-config.seed.json.
 *
 *   npm run seed          # insert only if the document does not exist
 *   npm run seed -- --force   # overwrite the existing document
 *
 * Requires MONGODB_URI (loaded from .env.local via dotenv). Without it, the app
 * uses the local JSON file store and this script is unnecessary.
 */
// โหลด .env.local ก่อน .env ให้ตรงกับลำดับที่ Next.js ใช้ — `import 'dotenv/config'`
// เฉย ๆ อ่านแค่ .env ทำให้ค่าที่ README บอกให้ใส่ใน .env.local ไม่ถูกอ่านเลย
import { config as loadEnv } from 'dotenv';
loadEnv({ path: ['.env.local', '.env'], quiet: true });

import { promises as fs } from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import type { PortalConfig } from '../src/types/portal';

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'namphrae_portal';
  const force = process.argv.includes('--force');

  if (!uri) {
    console.error(
      '✗ MONGODB_URI is not set. Set it in .env.local to seed MongoDB.\n' +
        '  (Without Mongo the app already reads data/portal-config.seed.json directly.)'
    );
    process.exit(1);
  }

  const seedPath = path.join(process.cwd(), 'data', 'portal-config.seed.json');
  const seed = JSON.parse(await fs.readFile(seedPath, 'utf8')) as PortalConfig;
  seed._id = 'portalConfig';
  if (typeof seed.visitorCount !== 'number') seed.visitorCount = 0;
  seed.updatedAt = new Date().toISOString();

  const client = await new MongoClient(uri).connect();
  try {
    const col = client.db(dbName).collection<PortalConfig>('config');
    const existing = await col.findOne({ _id: 'portalConfig' });

    if (existing && !force) {
      console.log(
        '• Config already exists (version ' +
          existing.version +
          '). Re-run with --force to overwrite.'
      );
      return;
    }

    await col.replaceOne({ _id: 'portalConfig' }, seed, { upsert: true });
    console.log(
      `✓ Seeded ${dbName}.config — ${seed.links.length} links, visitorCount ${seed.visitorCount}`
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

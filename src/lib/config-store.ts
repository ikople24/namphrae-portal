import { promises as fs } from 'fs';
import path from 'path';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import { CONFIG_ID, type PortalConfig, type PublicConfig } from '@/types/portal';

// The store hides where the single PortalConfig document lives:
//   - MongoDB collection `config` when MONGODB_URI is set (production)
//   - a local JSON file under /data when it is not (zero-config dev / preview)
//
// Both back ends operate on the whole document. For a single-editor municipal
// tool this read-modify-write model is simple and adequate; the write path bumps
// `version` and stamps `updatedAt` on every mutation. (See PLAN §8 for the
// atomic-operator caution if concurrency ever becomes a concern.)

const DATA_DIR = path.join(process.cwd(), 'data');
const RUNTIME_FILE = path.join(DATA_DIR, 'portal-config.json');
const SEED_FILE = path.join(DATA_DIR, 'portal-config.seed.json');

export function usingMongo(): boolean {
  return isMongoConfigured();
}

async function readSeed(): Promise<PortalConfig> {
  const raw = await fs.readFile(SEED_FILE, 'utf8');
  const seed = JSON.parse(raw) as PortalConfig;
  seed._id = CONFIG_ID;
  if (typeof seed.visitorCount !== 'number') seed.visitorCount = 0;
  return seed;
}

// ---- file backend ----------------------------------------------------------

async function fileRead(): Promise<PortalConfig> {
  try {
    const raw = await fs.readFile(RUNTIME_FILE, 'utf8');
    return JSON.parse(raw) as PortalConfig;
  } catch {
    // First run: materialise the runtime file from the seed.
    const seed = await readSeed();
    await fileWrite(seed);
    return seed;
  }
}

async function fileWrite(config: PortalConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RUNTIME_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

// ---- mongo backend ---------------------------------------------------------

async function mongoRead(): Promise<PortalConfig> {
  const db = await getDb();
  const doc = await db
    .collection<PortalConfig>('config')
    .findOne({ _id: CONFIG_ID });
  if (doc) return doc;
  // Empty database: seed it once.
  const seed = await readSeed();
  await db.collection<PortalConfig>('config').insertOne(seed);
  return seed;
}

async function mongoWrite(config: PortalConfig): Promise<void> {
  const db = await getDb();
  const { _id, ...rest } = config;
  await db
    .collection<PortalConfig>('config')
    .updateOne({ _id: _id || CONFIG_ID }, { $set: rest }, { upsert: true });
}

// ---- public API ------------------------------------------------------------

export async function getConfig(): Promise<PortalConfig> {
  const config = usingMongo() ? await mongoRead() : await fileRead();
  return normalise(config);
}

/**
 * Persist a full config document. Bumps version + updatedAt automatically.
 */
export async function saveConfig(
  next: PortalConfig,
  updatedBy?: string
): Promise<PortalConfig> {
  const current = await getConfig();
  const toSave: PortalConfig = normalise({
    ...next,
    _id: CONFIG_ID,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy ?? next.updatedBy,
  });
  if (usingMongo()) await mongoWrite(toSave);
  else await fileWrite(toSave);
  return toSave;
}

/**
 * Mutate the config with a callback and persist the result atomically enough
 * for a single editor. Returns the saved document.
 */
export async function mutateConfig(
  mutator: (draft: PortalConfig) => void | Promise<void>,
  updatedBy?: string
): Promise<PortalConfig> {
  const current = await getConfig();
  const draft: PortalConfig = structuredClone(current);
  await mutator(draft);
  return saveConfig(draft, updatedBy);
}

/**
 * Increment a link's click count (and optionally the visitor count) without a
 * version bump — high-frequency counters should not churn the document version.
 */
export async function incrementClick(linkId: string): Promise<boolean> {
  if (usingMongo()) {
    const db = await getDb();
    const res = await db
      .collection<PortalConfig>('config')
      .updateOne(
        { _id: CONFIG_ID, 'links.id': linkId },
        { $inc: { 'links.$.clickCount': 1 } }
      );
    return res.modifiedCount > 0;
  }
  const config = await fileRead();
  const link = config.links.find((l) => l.id === linkId);
  if (!link) return false;
  link.clickCount += 1;
  await fileWrite(config);
  return true;
}

export async function incrementVisitor(): Promise<number> {
  if (usingMongo()) {
    const db = await getDb();
    const res = await db
      .collection<PortalConfig>('config')
      .findOneAndUpdate(
        { _id: CONFIG_ID },
        { $inc: { visitorCount: 1 } },
        { returnDocument: 'after', upsert: false }
      );
    return res?.visitorCount ?? 0;
  }
  const config = await fileRead();
  config.visitorCount = (config.visitorCount ?? 0) + 1;
  await fileWrite(config);
  return config.visitorCount;
}

// Strip admin-only fields and inactive links for the public page / API.
export function toPublicConfig(config: PortalConfig): PublicConfig {
  return {
    version: config.version,
    updatedAt: config.updatedAt,
    visitorCount: config.visitorCount ?? 0,
    site: config.site,
    categories: [...config.categories].sort((a, b) => a.order - b.order),
    links: config.links
      .filter((l) => l.isActive)
      .sort((a, b) => a.order - b.order)
      .map(({ isActive: _isActive, ...rest }) => rest),
  };
}

// Defensive defaults so an older/partial document never crashes a render.
function normalise(config: PortalConfig): PortalConfig {
  return {
    _id: CONFIG_ID,
    version: config.version ?? 1,
    updatedAt: config.updatedAt ?? new Date(0).toISOString(),
    updatedBy: config.updatedBy,
    visitorCount: config.visitorCount ?? 0,
    site: config.site,
    categories: config.categories ?? [],
    lineGroupId: config.lineGroupId,
    links: (config.links ?? []).map((l) => ({
      ...l,
      clickCount: l.clickCount ?? 0,
      openInNewTab: l.openInNewTab ?? true,
      isActive: l.isActive ?? true,
      isFeatured: l.isFeatured ?? false,
    })),
  };
}

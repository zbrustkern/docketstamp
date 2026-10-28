import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { Order, ImageCachePoolItem, DiscountCode, SystemIncident } from "./types";
import { readOrderRecord, resolvePostalProvenance } from "./order-record";
import { optimizeCoverImage } from "./image-optimizer";
import { resolveFirebaseConfig } from "./firebase-config";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "mock-firestore.json");
// Parallel offline suites must not read or overwrite each other's disk fixtures.
const MEMORY_ONLY_MOCK = process.env.NODE_ENV === 'test' && process.env.USE_MOCK_FIRESTORE === 'true' && process.env.MOCK_FIRESTORE_MEMORY_ONLY === 'true';

// Mock Document and Query Snapshots
class MockDocumentSnapshot<T = unknown> {
  constructor(private _id: string, private _data: T | undefined, private _ref?: MockDocRef<T>) {}
  get id() {
    return this._id;
  }
  get exists() {
    return this._data !== undefined;
  }
  get ref() {
    return this._ref;
  }
  data(): T | undefined {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

class MockQuerySnapshot<T = unknown> {
  constructor(private _docs: MockDocumentSnapshot<T>[]) {}
  get docs() {
    return this._docs;
  }
  get empty() {
    return this._docs.length === 0;
  }
  get size() {
    return this._docs.length;
  }
  forEach(callback: (doc: MockDocumentSnapshot<T>) => void) {
    this._docs.forEach(callback);
  }
}

class MockDocRef<T = unknown> {
  constructor(private _collection: MockCollection<T>, private _id: string) {}
  get id() {
    return this._id;
  }
  async get(): Promise<MockDocumentSnapshot<T>> {
    const data = this._collection.store.get(this._id);
    return new MockDocumentSnapshot<T>(this._id, data, this);
  }
  async set(data: T, options?: { merge?: boolean }): Promise<void> {
    if (options?.merge && this._collection.store.has(this._id)) {
      const existing = this._collection.store.get(this._id);
      this._collection.store.set(this._id, { ...existing, ...data });
    } else {
      this._collection.store.set(this._id, JSON.parse(JSON.stringify(data)));
    }
    this._collection.notifyChanged();
  }
  async update(data: Partial<T>): Promise<void> {
    const existing = this._collection.store.get(this._id);
    if (!existing) {
      throw new Error(`Document ${this._id} does not exist.`);
    }
    this._collection.store.set(this._id, { ...existing, ...data });
    this._collection.notifyChanged();
  }
  async delete(): Promise<void> {
    this._collection.store.delete(this._id);
    this._collection.notifyChanged();
  }
}

// Local test double only. Queries retain all predicates/order/cursor constraints.
class MockQuery<T = Record<string, unknown>> {
  constructor(
    private collection: MockCollection<T>,
    private filters: Array<[string, string, unknown]> = [],
    private ordering: Array<[string, "asc" | "desc"]> = [],
    private maximum = Number.MAX_SAFE_INTEGER,
    private cursor?: unknown[],
  ) {}
  private value(data: unknown, field: string): any {
    return field.split(".").reduce((value: any, key) => value?.[key], data);
  }
  where(field: string, op: string, value: unknown) {
    return new MockQuery(this.collection, [...this.filters, [field, op, value]], this.ordering, this.maximum, this.cursor);
  }
  orderBy(field: string, direction: "asc" | "desc" = "asc") {
    return new MockQuery(this.collection, this.filters, [...this.ordering, [field, direction]], this.maximum, this.cursor);
  }
  limit(n: number) {
    return new MockQuery(this.collection, this.filters, this.ordering, n, this.cursor);
  }
  startAfter(...values: unknown[]) {
    const first = values[0] as any;
    const cursor = first?.data instanceof Function
      ? this.ordering.map(([field]) => field === "__name__" ? first.id : this.value(first.data(), field))
      : values;
    return new MockQuery(this.collection, this.filters, this.ordering, this.maximum, cursor);
  }
  async get(): Promise<MockQuerySnapshot<T>> {
    const read = (id: string, data: T, field: string) => field === "__name__" ? id : this.value(data, field);
    const compare = (a: any, b: any) => a === b ? 0 : a > b ? 1 : -1;
    const rows = [...this.collection.store.entries()].filter(([id, data]) => this.filters.every(([field, op, expected]) => {
      const actual = read(id, data, field);
      switch (op) {
        case "==": return actual === expected;
        case "!=": return actual !== undefined && actual !== expected;
        case ">=": return actual >= (expected as any);
        case ">": return actual > (expected as any);
        case "<=": return actual <= (expected as any);
        case "<": return actual < (expected as any);
        case "in": return Array.isArray(expected) && expected.includes(actual);
        case "array-contains": return Array.isArray(actual) && actual.includes(expected);
        default: throw new Error(`Unsupported mock query operator: ${op}`);
      }
    }));
    rows.sort(([aid, a], [bid, b]) => {
      for (const [field, direction] of this.ordering) {
        const result = compare(read(aid, a, field), read(bid, b, field)) * (direction === "desc" ? -1 : 1);
        if (result) return result;
      }
      return compare(aid, bid);
    });
    const after = this.cursor ? rows.filter(([id, data]) => {
      for (let i = 0; i < this.ordering.length; i++) {
        const [field, direction] = this.ordering[i];
        const result = compare(read(id, data, field), this.cursor![i]) * (direction === "desc" ? -1 : 1);
        if (result) return result > 0;
      }
      return false;
    }) : rows;
    return new MockQuerySnapshot(after.slice(0, this.maximum).map(([id, data]) => new MockDocumentSnapshot(id, data, this.collection.doc(id))));
  }
}

class MockCollection<T = Record<string, unknown>> {
  public store = new Map<string, T>();

  constructor(private firestore?: MockFirestore) {}

  public notifyChanged() {
    if (this.firestore) {
      this.firestore.scheduleSave();
    }
  }

  doc(id?: string): MockDocRef<T> {
    const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new MockDocRef<T>(this, docId);
  }

  limit(n: number) { return new MockQuery(this).limit(n); }
  where(field: string, op: string, value: unknown) { return new MockQuery(this).where(field, op, value); }
  orderBy(field: string, direction: "asc" | "desc" = "asc") { return new MockQuery(this).orderBy(field, direction); }

  async get(): Promise<MockQuerySnapshot<T>> {
    const results: MockDocumentSnapshot<T>[] = [];
    for (const [id, data] of this.store.entries()) {
      results.push(new MockDocumentSnapshot<T>(id, data, this.doc(id)));
    }
    return new MockQuerySnapshot<T>(results);
  }
}

class MockFirestore {
  private collections = new Map<string, MockCollection>();
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    if (!MEMORY_ONLY_MOCK) this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (typeof process !== "undefined" && fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        for (const [colName, docs] of Object.entries(parsed)) {
          const col = this.collection(colName);
          if (docs && typeof docs === "object") {
            for (const [docId, docData] of Object.entries(docs as Record<string, unknown>)) {
              col.store.set(docId, docData as Record<string, unknown>);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[MockFirestore] Notice reading persistent store:", err);
    }
  }

  public scheduleSave() {
    if (MEMORY_ONLY_MOCK) return;
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveToDisk();
    }, 150);
  }

  public saveToDisk() {
    if (MEMORY_ONLY_MOCK) return;
    try {
      if (typeof process !== "undefined") {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const serialized: Record<string, Record<string, unknown>> = {};
        for (const [colName, col] of this.collections.entries()) {
          serialized[colName] = {};
          for (const [docId, docData] of col.store.entries()) {
            serialized[colName][docId] = docData;
          }
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(serialized, null, 2), "utf-8");
      }
    } catch (err) {
      console.warn("[MockFirestore] Notice saving store to disk:", err);
    }
  }

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection(this));
    }
    return this.collections.get(name)!;
  }

  private transactionQueue: Promise<void> = Promise.resolve();

  async runTransaction<T>(
    updateFunction: (transaction: MockTransaction) => Promise<T>
  ): Promise<T> {
    let result: T;
    let thrownError: unknown;

    await new Promise<void>((resolveNext) => {
      this.transactionQueue = this.transactionQueue
        .catch(() => {})
        .then(async () => {
          try {
            const tx = new MockTransaction(this);
            result = await updateFunction(tx);
            await tx.commit();
          } catch (err) {
            thrownError = err;
          } finally {
            resolveNext();
          }
        });
    });

    if (thrownError !== undefined) {
      throw thrownError;
    }
    return result!;
  }
}

class MockTransaction {
  private writes: Array<() => Promise<void>> = [];
  private updates: Array<MockDocRef<any>> = [];
  constructor(private firestore: MockFirestore) {}
  async get<T = unknown>(ref: MockDocRef<T>): Promise<MockDocumentSnapshot<T>> {
    if (this.writes.length) throw new Error("Firestore transactions require all reads before writes");
    return ref.get();
  }
  create<T = unknown>(ref: MockDocRef<T>, data: T): this {
    this.writes.push(async () => {
      if ((await ref.get()).exists) throw new Error(`Document ${ref.id} already exists.`);
      await ref.set(data);
    });
    return this;
  }
  set<T = unknown>(ref: MockDocRef<T>, data: T, options?: { merge?: boolean }): this {
    this.writes.push(() => ref.set(data, options));
    return this;
  }
  update<T = unknown>(ref: MockDocRef<T>, data: Partial<T>): this {
    this.updates.push(ref);
    this.writes.push(() => ref.update(data));
    return this;
  }
  delete<T = unknown>(ref: MockDocRef<T>): this {
    this.writes.push(() => ref.delete());
    return this;
  }
  async commit(): Promise<void> {
    for (const ref of this.updates) {
      if (!(await ref.get()).exists) throw new Error(`Document ${ref.id} does not exist.`);
    }
    for (const write of this.writes) await write();
  }
}

const mockFirestoreInstance = new MockFirestore();

function configureDb(db: admin.firestore.Firestore): admin.firestore.Firestore {
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (_e) {
    // Ignore if settings have already been locked by an earlier call
  }
  return db;
}

// Recursively strips any properties with `undefined` values to satisfy Firestore
export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((item) =>
      typeof item === "object" && item !== null ? sanitizeFirestoreData(item) : item
    ) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !(value instanceof Date)) {
        cleaned[key] = sanitizeFirestoreData(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as T;
}

// Singleton check for Real vs Mock Firebase Admin
function initializeFirebase() {
  const projectId = getExpectedFirebaseProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (process.env.USE_MOCK_FIRESTORE === 'true') {
    if (isHostedOrProductionRuntime()) {
      throw new Error('[Firebase Admin Critical] USE_MOCK_FIRESTORE is strictly prohibited in hosted and production runtimes.');
    }
    console.log(MEMORY_ONLY_MOCK ? '[Firebase Admin] Using isolated in-memory mock Firestore.' : '[Firebase Admin] Using disk-persisted mock Firestore store (.data/mock-firestore.json) via USE_MOCK_FIRESTORE.');
    if (admin.apps.length === 0) {
      try {
        admin.initializeApp({ projectId });
      } catch (_e) {}
    }
    return { db: mockFirestoreInstance as unknown as admin.firestore.Firestore, isMock: true };
  }

  if (admin.apps.length > 0) {
    if (admin.apps[0]?.options.projectId !== projectId) {
      throw new Error("[Firebase Admin Critical] Existing Admin app project does not match configured DocketStamp project.");
    }
    return { db: configureDb(admin.firestore()), isMock: false };
  }

  // 1. Explicit Service Account credentials
  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("[Firebase Admin] Connected to live Cloud Firestore via Service Account:", projectId);
      return { db: configureDb(admin.firestore()), isMock: false };
    } catch (err) {
      console.warn("[Firebase Admin] Error initializing live SDK with cert, falling back:", err);
    }
  }

  // 2. Google Cloud / Firebase App Hosting / Cloud Run Application Default Credentials
  if (
    process.env.K_SERVICE ||
    process.env.FIREBASE_CONFIG ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    (process.env.NODE_ENV === "production" && projectId)
  ) {
    try {
      admin.initializeApp({
        projectId: projectId || process.env.GOOGLE_CLOUD_PROJECT,
      });
      console.log("[Firebase Admin] Connected to live Cloud Firestore via App Hosting ADC:", projectId);
      return { db: configureDb(admin.firestore()), isMock: false };
    } catch (err) {
      console.warn("[Firebase Admin] Error initializing ADC Firestore:", err);
    }
  }

  if (isHostedOrProductionRuntime()) {
    throw new Error('[Firebase Admin Critical] Live Firebase Admin initialization failed; refusing mock Firestore fallback in hosted and production runtimes.');
  }

  console.log("[Firebase Admin] Using disk-persisted mock Firestore store (.data/mock-firestore.json).");
  if (admin.apps.length === 0) {
    try {
      admin.initializeApp({ projectId });
    } catch (_e) {
      // Ignore if already initialized
    }
  }
  return { db: mockFirestoreInstance as unknown as admin.firestore.Firestore, isMock: true };
}

const { db: firestoreDb, isMock: isFirestoreMock } = initializeFirebase();

export type FirebaseAuthTestVerifier = (token: string, projectId: string) => Promise<admin.auth.DecodedIdToken | null>;
let firebaseAuthTestVerifier: FirebaseAuthTestVerifier | null = null;

function isHostedOrProductionRuntime() {
  return process.env.NODE_ENV === "production" || Boolean(
    process.env.K_SERVICE || process.env.FIREBASE_CONFIG || process.env.GAE_ENV ||
    process.env.APPHOSTING_BACKEND_ID
  );
}

/** Explicit offline-only verifier injection. Hosted runtimes can never enable this path. */
export function setFirebaseAuthTestVerifier(verifier: FirebaseAuthTestVerifier | null) {
  if (verifier && (
    process.env.NODE_ENV !== "test" ||
    process.env.FIREBASE_AUTH_TEST_VERIFIER !== "true" ||
    isHostedOrProductionRuntime()
  )) {
    throw new Error("Firebase Auth test verifier is available only in explicitly configured offline tests.");
  }
  firebaseAuthTestVerifier = verifier;
}

function getExpectedFirebaseProjectId() {
  const isStagingEnv =
    process.env.ENVIRONMENT === "staging" ||
    process.env.FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "docketstamp-staging" ||
    (typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.includes("staging")) ||
    (typeof process.env.K_SERVICE === "string" && process.env.K_SERVICE.includes("staging")) ||
    (typeof process.env.FIREBASE_CONFIG === "string" && process.env.FIREBASE_CONFIG.includes("docketstamp-staging"));
  const configuredProjectId = resolveFirebaseConfig({
    ENVIRONMENT: process.env.ENVIRONMENT,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  }).projectId;
  if (isStagingEnv && configuredProjectId !== "docketstamp-staging") {
    throw new Error("Firebase Admin project mismatch: staging runtime indicators conflict with the configured project.");
  }
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== configuredProjectId) {
    throw new Error("Firebase Admin project mismatch: GOOGLE_CLOUD_PROJECT does not match the configured DocketStamp project.");
  }
  return configuredProjectId;
}

/**
 * Verifies a client-supplied Firebase ID token using Firebase Admin Auth.
 * Returns the decoded token payload or null if invalid or missing.
 */
export async function verifyFirebaseIdToken(
  token?: string | null
): Promise<admin.auth.DecodedIdToken | null> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return null;
  }
  const cleanToken = token.trim();

  if (cleanToken.startsWith("mock_token_")) {
    if (!firebaseAuthTestVerifier || process.env.NODE_ENV !== "test" ||
        process.env.FIREBASE_AUTH_TEST_VERIFIER !== "true" || isHostedOrProductionRuntime()) return null;
    const expectedProjectId = getExpectedFirebaseProjectId();
    try {
      return validateVerifiedFirebaseClaims(
        await firebaseAuthTestVerifier(cleanToken, expectedProjectId),
        expectedProjectId,
      );
    } catch (err) {
      console.warn("[Auth] Offline test token verifier rejected token:", err);
      return null;
    }
  }

  const expectedProjectId = getExpectedFirebaseProjectId();

  // Initialize only for the configured project. Never select a trust boundary from JWT claims.
  if (admin.apps.length === 0) {
    try {
      admin.initializeApp({ projectId: expectedProjectId });
    } catch (_e) {}
  }
  const appProjectId = admin.apps[0]?.options.projectId;
  if (appProjectId !== expectedProjectId) {
    console.error(`[Auth] Refusing Firebase Admin app for unexpected or unconfigured project; expected configured DocketStamp project.`);
    return null;
  }

  // Firebase Admin checks signature, issuer, audience, expiry, and revocation.
  return verifyFirebaseIdTokenWithVerifier(
    cleanToken,
    expectedProjectId,
    (value, checkRevoked) => admin.auth().verifyIdToken(value, checkRevoked),
  );
}

/** Shared fail-closed boundary, exported for deterministic offline contract tests. */
export async function verifyFirebaseIdTokenWithVerifier(
  token: string,
  expectedProjectId: string,
  verifier: (token: string, checkRevoked: true) => Promise<admin.auth.DecodedIdToken>,
): Promise<admin.auth.DecodedIdToken | null> {
  try {
    return validateVerifiedFirebaseClaims(await verifier(token, true), expectedProjectId);
  } catch (err) {
    console.warn("[Auth] Failed to verify Firebase ID token:", err);
    return null;
  }
}

function validateVerifiedFirebaseClaims(
  decoded: admin.auth.DecodedIdToken | null,
  expectedProjectId: string,
): admin.auth.DecodedIdToken | null {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!decoded || decoded.aud !== expectedProjectId ||
      decoded.iss !== `https://securetoken.google.com/${expectedProjectId}` ||
      typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp) || decoded.exp <= nowSeconds ||
      typeof decoded.uid !== "string" || decoded.uid.length === 0 || decoded.sub !== decoded.uid) {
    return null;
  }
  return decoded;
}

export { firestoreDb, isFirestoreMock };

// Collection Helpers
export const ORDERS_COLLECTION = "orders";
export const IMAGE_CACHE_POOL_COLLECTION = "image_cache_pool";
export const SYSTEM_INCIDENTS_COLLECTION = "system_incidents";
export const ADMIN_AUTH_ATTEMPTS_COLLECTION = "admin_auth_attempts";

export const getOrdersCollection = () => firestoreDb.collection(ORDERS_COLLECTION);
export const getImageCachePoolCollection = () => firestoreDb.collection(IMAGE_CACHE_POOL_COLLECTION);
export const getSystemIncidentsCollection = () => firestoreDb.collection(SYSTEM_INCIDENTS_COLLECTION);
export const getAdminAuthAttemptsCollection = () => firestoreDb.collection(ADMIN_AUTH_ATTEMPTS_COLLECTION);

export async function recordSystemIncident(
  incident: Omit<SystemIncident, "id" | "createdAt" | "resolved">
): Promise<void> {
  try {
    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullIncident: SystemIncident = sanitizeFirestoreData({
      ...incident,
      id,
      resolved: false,
      createdAt: Date.now(),
    });
    await getSystemIncidentsCollection().doc(id).set(fullIncident);
  } catch (err) {
    console.error("[Record System Incident Error]", err);
  }
}

export async function saveOrder(order: Order): Promise<void> {
  const sanitized = sanitizeFirestoreData({ ...order });
  if (sanitized.frontImageUrl && sanitized.frontImageUrl.length > 800000) {
    try {
      sanitized.frontImageUrl = await optimizeCoverImage(sanitized.frontImageUrl);
    } catch (err) {
      console.warn("[saveOrder] Image optimization notice:", err);
    }
  }
  await getOrdersCollection().doc(sanitized.id).set(sanitized);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const doc = await getOrdersCollection().doc(orderId).get();
  if (!doc.exists) return null;
  return readOrderRecord(doc.data()).order;
}

export async function getOrderByDocketId(docketId: string): Promise<Order | null> {
  const snapshot = await getOrdersCollection().where("docketId", "==", docketId).limit(1).get();
  if (snapshot.empty) return null;
  return readOrderRecord(snapshot.docs[0].data()).order;
}

export async function getOrderByLobLetterId(letterId: string): Promise<Order | null> {
  const snapshot = await getOrdersCollection().where("lobLetterId", "==", letterId).limit(1).get();
  if (snapshot.empty) return null;
  const order = readOrderRecord(snapshot.docs[0].data()).order;
  return resolvePostalProvenance(order).provider === "lob" ? order : null;
}

export async function updateOrderStatus(
  orderId: string,
  update: Partial<Order>
): Promise<void> {
  const sanitized = sanitizeFirestoreData({
    ...update,
    updatedAt: Date.now(),
  });
  await getOrdersCollection().doc(orderId).update(sanitized);
}

export async function saveImageCacheItem(item: ImageCachePoolItem): Promise<void> {
  const sanitized = sanitizeFirestoreData({ ...item });
  if (sanitized.imageUrl && sanitized.imageUrl.length > 800000) {
    try {
      sanitized.imageUrl = await optimizeCoverImage(sanitized.imageUrl);
    } catch (err) {
      console.warn("[saveImageCacheItem] Image optimization notice:", err);
    }
  }
  await getImageCachePoolCollection().doc(sanitized.id).set(sanitized);
}

export async function claimImageCacheItem(id: string): Promise<void> {
  const doc = await getImageCachePoolCollection().doc(id).get();
  if (doc.exists) {
    await getImageCachePoolCollection().doc(id).update({
      status: "CLAIMED",
    });
  }
}

// System Config Helpers
export const SYSTEM_CONFIG_COLLECTION = "system_config";
export const getSystemConfigCollection = () => firestoreDb.collection(SYSTEM_CONFIG_COLLECTION);

export async function getSystemConfig<T = Record<string, unknown>>(configId: string): Promise<T | null> {
  const doc = await getSystemConfigCollection().doc(configId).get();
  if (!doc.exists) return null;
  return doc.data() as T;
}

export async function setSystemConfig(configId: string, data: Record<string, unknown>): Promise<void> {
  const sanitized = sanitizeFirestoreData(data);
  await getSystemConfigCollection().doc(configId).set(sanitized, { merge: true });
}

// Discount Code Helpers
export const DISCOUNT_CODES_COLLECTION = "discount_codes";
export const getDiscountCodesCollection = () => firestoreDb.collection(DISCOUNT_CODES_COLLECTION);

export async function getDiscountCode(code: string): Promise<DiscountCode | null> {
  const normalized = code.trim().toUpperCase();
  const doc = await getDiscountCodesCollection().doc(normalized).get();
  if (!doc.exists) return null;
  return doc.data() as DiscountCode;
}

export async function getAllDiscountCodes(): Promise<DiscountCode[]> {
  const snapshot = await getDiscountCodesCollection().get();
  const codes: DiscountCode[] = [];
  snapshot.forEach((doc) => {
    codes.push(doc.data() as DiscountCode);
  });
  // Sort newest first
  return codes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function saveDiscountCode(discount: DiscountCode): Promise<void> {
  const normalized = discount.code.trim().toUpperCase();
  await getDiscountCodesCollection().doc(normalized).set({
    ...discount,
    code: normalized,
    id: normalized,
    updatedAt: Date.now(),
  }, { merge: true });
}

export async function deleteDiscountCode(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  await getDiscountCodesCollection().doc(normalized).delete();
}

export async function recordDiscountUsage(code: string, discountAmountCents: number): Promise<void> {
  const normalized = code.trim().toUpperCase();
  const doc = await getDiscountCodesCollection().doc(normalized).get();
  if (!doc.exists) return;
  const current = doc.data() as DiscountCode;
  await getDiscountCodesCollection().doc(normalized).update({
    usedCount: (current.usedCount || 0) + 1,
    totalDiscountGivenCents: (current.totalDiscountGivenCents || 0) + discountAmountCents,
    updatedAt: Date.now(),
  });
}

/**
 * Auto-resolves any open incidents associated with a specific orderId.
 */
export async function resolveIncidentsForOrder(
  orderId: string,
  resolutionNote: string
): Promise<number> {
  try {
    const col = getSystemIncidentsCollection();
    const snapshot = await col.where("resolved", "==", false).get();
    let count = 0;
    for (const doc of snapshot.docs) {
      const data = doc.data() as SystemIncident;
      if (data?.metadata?.orderId === orderId) {
        await col.doc(doc.id).update({
          resolved: true,
          resolvedAt: Date.now(),
          resolutionNote,
        });
        count++;
      }
    }
    return count;
  } catch (err) {
    console.warn("[resolveIncidentsForOrder] Notice:", err);
    return 0;
  }
}

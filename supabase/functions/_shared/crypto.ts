/// <reference lib="deno.ns" />
import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

/**
 * Shared crypto helper for Edge Functions
 * 
 * Uses pgcrypto via direct database connection to encrypt/decrypt sensitive text.
 * Supports key rotation via DATA_ENCRYPTION_KEY_PREV.
 * 
 * Incremental encryption: New encrypted fields are prefixed with ENC_PREFIX_V1.
 * Legacy plaintext fields are returned as-is (no prefix).
 */

const ENC_PREFIX_V1 = "enc:v1:";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL environment variable is required');
    }
    pool = new Pool(dbUrl, 1, true);
  }
  return pool;
}

function getEncryptionKey(): string {
  const key = Deno.env.get('DATA_ENCRYPTION_KEY_V1');
  if (!key) {
    throw new Error('DATA_ENCRYPTION_KEY_V1 environment variable is required');
  }
  return key;
}

function getPreviousEncryptionKey(): string | null {
  return Deno.env.get('DATA_ENCRYPTION_KEY_PREV') || null;
}

/**
 * Encrypt plaintext using pgcrypto
 * @param plain - Plain text to encrypt
 * @returns Base64-encoded ciphertext
 */
export async function encryptText(plain: string): Promise<string> {
  const pool = getPool();
  const key = getEncryptionKey();

  const client = await pool.connect();
  try {
    const result = await client.queryObject<{ encrypted: string }>(
      `SELECT encode(pgp_sym_encrypt($1::text, $2::text), 'base64') as encrypted`,
      [plain, key]
    );
    
    if (!result.rows || result.rows.length === 0 || !result.rows[0]?.encrypted) {
      throw new Error('Encryption failed: no result returned');
    }
    
    return result.rows[0].encrypted;
  } finally {
    client.release();
  }
}

/**
 * Decrypt base64-encoded ciphertext using pgcrypto
 * Tries DATA_ENCRYPTION_KEY_V1 first, then DATA_ENCRYPTION_KEY_PREV if present
 * @param cipherB64 - Base64-encoded ciphertext
 * @returns Decrypted plaintext
 */
export async function decryptText(cipherB64: string): Promise<string> {
  const pool = getPool();
  const keyV1 = getEncryptionKey();
  const keyPrev = getPreviousEncryptionKey();

  const client = await pool.connect();
  try {
    // Try current key first
    try {
      const result = await client.queryObject<{ decrypted: string }>(
        `SELECT pgp_sym_decrypt(decode($1, 'base64'), $2::text) as decrypted`,
        [cipherB64, keyV1]
      );
      
      if (result.rows && result.rows.length > 0 && result.rows[0]?.decrypted) {
        return result.rows[0].decrypted;
      }
    } catch (err) {
      // If decryption with V1 key fails and we have a previous key, try it
      if (keyPrev) {
        const result = await client.queryObject<{ decrypted: string }>(
          `SELECT pgp_sym_decrypt(decode($1, 'base64'), $2::text) as decrypted`,
          [cipherB64, keyPrev]
        );
        
        if (result.rows && result.rows.length > 0 && result.rows[0]?.decrypted) {
          return result.rows[0].decrypted;
        }
      }
      
      // Re-throw original error if both keys failed
      throw err;
    }
    
    throw new Error('Decryption failed: no result returned');
  } finally {
    client.release();
  }

}

// -----------------------------
// Convenience helpers
// -----------------------------

/**
 * Encrypt a JSON-serializable value.
 * Useful for storing structured payloads (e.g. insights/report blobs) as encrypted text.
 */
export async function encryptJson(value: unknown): Promise<string> {
  const json = JSON.stringify(value);
  return await encryptText(json);
}

/**
 * Decrypt an encrypted JSON string and parse it.
 */
export async function decryptJson<T = unknown>(cipherB64: string): Promise<T> {
  const json = await decryptText(cipherB64);
  return JSON.parse(json) as T;
}

/**
 * Encrypt multiple strings in parallel.
 */
export async function encryptTextMany(values: string[]): Promise<string[]> {
  return await Promise.all(values.map((v) => encryptText(v)));
}

/**
 * Decrypt multiple base64 ciphertext strings in parallel.
 */
export async function decryptTextMany(values: string[]): Promise<string[]> {
  return await Promise.all(values.map((v) => decryptText(v)));
}

/**
 * Encrypt selected fields of an object and return a shallow-cloned copy.
 *
 * - Fields not listed are copied as-is.
 * - `null`/`undefined` are left as-is.
 * - Non-string values are JSON-stringified before encryption.
 *
 * Intended pattern:
 *   const payloadEnc = await encryptJson(payload)
 *   OR
 *   const row = await encryptObjectFields(input, ['title','body'])
 */
export async function encryptObjectFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const out: any = { ...obj };
  for (const f of fields) {
    const v = obj[f];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') {
      out[f] = await encryptText(v);
    } else {
      out[f] = await encryptText(JSON.stringify(v));
    }
  }
  return out as T;
}

/**
 * Decrypt selected fields of an object and return a shallow-cloned copy.
 *
 * By default returns strings. If you stored JSON-stringified non-strings,
 * you can parse them on the caller side.
 */
export async function decryptObjectFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const out: any = { ...obj };
  for (const f of fields) {
    const v = obj[f];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string') continue;
    out[f] = await decryptText(v);
  }
  return out as T;
}

// -----------------------------
// Incremental encryption helpers (prefix-based)
// -----------------------------

/**
 * Encrypt a field with V1 prefix for incremental encryption.
 * New encrypted fields are prefixed with "enc:v1:" to distinguish from legacy plaintext.
 * @param plain - Plain text to encrypt
 * @returns Prefixed base64-encoded ciphertext: "enc:v1:" + base64(pgp_sym_encrypt(...))
 */
export async function encryptFieldV1(plain: string): Promise<string> {
  const encrypted = await encryptText(plain);
  return ENC_PREFIX_V1 + encrypted;
}

/**
 * Decrypt a field that may be encrypted (with prefix) or plaintext (legacy).
 * - If value starts with ENC_PREFIX_V1: decrypt and return plaintext
 * - Otherwise: return as-is (assumed to be legacy plaintext)
 * @param value - Field value (may be encrypted with prefix or plaintext)
 * @returns Decrypted plaintext or original value if not encrypted
 */
export async function decryptFieldMaybe(value: string): Promise<string> {
  if (!value) return value;
  if (value.startsWith(ENC_PREFIX_V1)) {
    const cipherB64 = value.slice(ENC_PREFIX_V1.length);
    return await decryptText(cipherB64);
  }
  return value; // plaintext legacy
}

/**
 * Encrypt a JSON-serializable value with V1 prefix.
 * @param value - Value to encrypt (will be JSON.stringify'd first)
 * @returns Prefixed encrypted JSON string
 */
export async function encryptJsonV1(value: unknown): Promise<string> {
  const json = JSON.stringify(value);
  return await encryptFieldV1(json);
}

/**
 * Decrypt a field that may contain encrypted JSON or plaintext JSON.
 * - If prefixed with ENC_PREFIX_V1: decrypt then JSON.parse
 * - Otherwise: try JSON.parse (legacy plaintext JSON) or return as-is
 * @param value - Field value (may be encrypted JSON or plaintext JSON)
 * @returns Parsed JSON object or original value if parsing fails
 */
export async function decryptJsonMaybe<T = unknown>(value: string): Promise<T> {
  if (!value) return value as T;
  
  if (value.startsWith(ENC_PREFIX_V1)) {
    const cipherB64 = value.slice(ENC_PREFIX_V1.length);
    const json = await decryptText(cipherB64);
    return JSON.parse(json) as T;
  }
  
  // Try parsing as plaintext JSON (legacy)
  try {
    return JSON.parse(value) as T;
  } catch {
    // If not valid JSON, return as-is
    return value as T;
  }
}

/** Source of random bytes; injectable for tests. */
export type RandomBytes = (length: number) => Uint8Array;

type CryptoLike = { getRandomValues: (array: Uint8Array) => Uint8Array };

/**
 * Web Crypto when the runtime has it (browsers, recent Hermes); otherwise `Math.random`, which
 * is enough here: the value only has to be unique per payment attempt, it is not a secret.
 */
const defaultRandomBytes: RandomBytes = (length) => {
  const bytes = new Uint8Array(length);
  const cryptoApi = (globalThis as { crypto?: Partial<CryptoLike> }).crypto;
  if (typeof cryptoApi?.getRandomValues === "function") return cryptoApi.getRandomValues(bytes);
  for (let index = 0; index < length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return bytes;
};

const UUID_BYTES = 16;
const VERSION_INDEX = 6;
const VARIANT_INDEX = 8;

const hex = (byte: number) => byte.toString(16).padStart(2, "0");

/** RFC 9562 version 4 UUID (random), e.g. the idempotency key of a payment attempt. */
export function createUuidV4(randomBytes: RandomBytes = defaultRandomBytes): string {
  const bytes = randomBytes(UUID_BYTES);
  bytes[VERSION_INDEX] = ((bytes[VERSION_INDEX] ?? 0) & 0x0f) | 0x40;
  bytes[VARIANT_INDEX] = ((bytes[VARIANT_INDEX] ?? 0) & 0x3f) | 0x80;
  const digits = Array.from(bytes, hex).join("");
  return [
    digits.slice(0, 8),
    digits.slice(8, 12),
    digits.slice(12, 16),
    digits.slice(16, 20),
    digits.slice(20, 32),
  ].join("-");
}

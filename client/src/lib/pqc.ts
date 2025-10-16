import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import type { PQCKeyPair } from '@shared/schema';

export class PQCrypto {
  private kemKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
  private dsaKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
  private sharedSecret: Uint8Array | null = null;

  async generateKEMKeyPair(): Promise<PQCKeyPair> {
    this.kemKeyPair = ml_kem768.keygen();
    
    return {
      publicKey: this.arrayToHex(this.kemKeyPair.publicKey),
      privateKey: this.arrayToHex(this.kemKeyPair.secretKey),
      algorithm: 'ml-kem-768',
      timestamp: Date.now(),
    };
  }

  async generateDSAKeyPair(): Promise<PQCKeyPair> {
    this.dsaKeyPair = ml_dsa65.keygen();
    
    return {
      publicKey: this.arrayToHex(this.dsaKeyPair.publicKey),
      privateKey: this.arrayToHex(this.dsaKeyPair.secretKey),
      algorithm: 'ml-dsa-65',
      timestamp: Date.now(),
    };
  }

  async encapsulate(peerPublicKey: string): Promise<{ ciphertext: string; sharedSecret: Uint8Array }> {
    const publicKey = this.hexToArray(peerPublicKey);
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
    this.sharedSecret = sharedSecret;
    
    return {
      ciphertext: this.arrayToHex(cipherText),
      sharedSecret,
    };
  }

  async decapsulate(ciphertext: string): Promise<Uint8Array> {
    if (!this.kemKeyPair) {
      throw new Error('KEM keypair not generated');
    }
    
    const ct = this.hexToArray(ciphertext);
    this.sharedSecret = ml_kem768.decapsulate(ct, this.kemKeyPair.secretKey);
    return this.sharedSecret;
  }

  async encrypt(message: string): Promise<string> {
    if (!this.sharedSecret) {
      throw new Error('No shared secret established');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    const key = await crypto.subtle.importKey(
      'raw',
      this.sharedSecret.slice(0, 32),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return this.arrayToHex(combined);
  }

  async decrypt(encryptedHex: string): Promise<string> {
    if (!this.sharedSecret) {
      throw new Error('No shared secret established');
    }

    const combined = this.hexToArray(encryptedHex);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const key = await crypto.subtle.importKey(
      'raw',
      this.sharedSecret.slice(0, 32),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  async sign(message: string): Promise<string> {
    if (!this.dsaKeyPair) {
      throw new Error('DSA keypair not generated');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const signature = ml_dsa65.sign(this.dsaKeyPair.secretKey, data);
    
    return this.arrayToHex(signature);
  }

  async verify(message: string, signatureHex: string, publicKeyHex: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const signature = this.hexToArray(signatureHex);
    const publicKey = this.hexToArray(publicKeyHex);
    
    return ml_dsa65.verify(publicKey, data, signature);
  }

  getKeyFingerprint(publicKey: string): string {
    const bytes = this.hexToArray(publicKey);
    const hash = Array.from(bytes.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return hash.match(/.{1,4}/g)?.join(':') || '';
  }

  private arrayToHex(arr: Uint8Array): string {
    return Array.from(arr)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hexToArray(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}

export const pqcrypto = new PQCrypto();

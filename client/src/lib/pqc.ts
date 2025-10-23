import { ml_kem512, ml_kem768, ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa44, ml_dsa65, ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import type { PQCKeyPair } from '@shared/schema';

export class PQCrypto {
  private kemKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
  private dsaKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
  private sharedSecret: Uint8Array | null = null;
  private keyExchangeInProgress: boolean = false;
  private currentKemAlgorithm: "ml-kem-512" | "ml-kem-768" | "ml-kem-1024" = "ml-kem-768";
  private currentSignatureAlgorithm: "ml-dsa-44" | "ml-dsa-65" | "ml-dsa-87" = "ml-dsa-65";

  async generateKEMKeyPair(algorithm: "ml-kem-512" | "ml-kem-768" | "ml-kem-1024" = "ml-kem-768"): Promise<PQCKeyPair> {
    if (this.kemKeyPair && this.currentKemAlgorithm === algorithm) {
      console.log("🔑 Reusing existing KEM keypair for", algorithm);
      return {
        publicKey: this.arrayToHex(this.kemKeyPair.publicKey),
        privateKey: this.arrayToHex(this.kemKeyPair.secretKey),
        kemAlgorithm: algorithm,
        signatureAlgorithm: this.currentSignatureAlgorithm,
        timestamp: Date.now(),
      };
    }
    
    console.log("🔑 Generating new KEM keypair with", algorithm);
    this.currentKemAlgorithm = algorithm;
    
    switch (algorithm) {
      case "ml-kem-512":
        this.kemKeyPair = ml_kem512.keygen();
        break;
      case "ml-kem-768":
        this.kemKeyPair = ml_kem768.keygen();
        break;
      case "ml-kem-1024":
        this.kemKeyPair = ml_kem1024.keygen();
        break;
    }
    
    return {
      publicKey: this.arrayToHex(this.kemKeyPair.publicKey),
      privateKey: this.arrayToHex(this.kemKeyPair.secretKey),
      kemAlgorithm: algorithm,
      signatureAlgorithm: this.currentSignatureAlgorithm,
      timestamp: Date.now(),
    };
  }

  async generateDSAKeyPair(algorithm: "ml-dsa-44" | "ml-dsa-65" | "ml-dsa-87" = "ml-dsa-65"): Promise<PQCKeyPair> {
    console.log("🔑 Generating DSA keypair with", algorithm);
    this.currentSignatureAlgorithm = algorithm;
    
    switch (algorithm) {
      case "ml-dsa-44":
        this.dsaKeyPair = ml_dsa44.keygen();
        break;
      case "ml-dsa-65":
        this.dsaKeyPair = ml_dsa65.keygen();
        break;
      case "ml-dsa-87":
        this.dsaKeyPair = ml_dsa87.keygen();
        break;
    }
    
    return {
      publicKey: this.arrayToHex(this.dsaKeyPair.publicKey),
      privateKey: this.arrayToHex(this.dsaKeyPair.secretKey),
      kemAlgorithm: this.currentKemAlgorithm,
      signatureAlgorithm: algorithm,
      timestamp: Date.now(),
    };
  }

  async encapsulate(peerPublicKey: string): Promise<{ ciphertext: string; sharedSecret: Uint8Array }> {
    if (this.keyExchangeInProgress) {
      throw new Error('Key exchange already in progress');
    }
    this.keyExchangeInProgress = true;
    
    try {
      const publicKey = this.hexToArray(peerPublicKey);
      let result;
      
      switch (this.currentKemAlgorithm) {
        case "ml-kem-512":
          result = ml_kem512.encapsulate(publicKey);
          break;
        case "ml-kem-768":
          result = ml_kem768.encapsulate(publicKey);
          break;
        case "ml-kem-1024":
          result = ml_kem1024.encapsulate(publicKey);
          break;
      }
      
      this.sharedSecret = result.sharedSecret;
      
      console.log("🔐 BOB: Encapsulation complete with", this.currentKemAlgorithm);
      
      return {
        ciphertext: this.arrayToHex(result.cipherText),
        sharedSecret: result.sharedSecret,
      };
    } finally {
      this.keyExchangeInProgress = false;
    }
  }

  async decapsulate(ciphertext: string): Promise<Uint8Array> {
    if (!this.kemKeyPair) {
      console.error("❌ KEM keypair is null! Current state:", {
        kemKeyPair: this.kemKeyPair,
        sharedSecret: this.sharedSecret ? 'exists' : 'null'
      });
      throw new Error('KEM keypair not generated');
    }
    
    if (this.keyExchangeInProgress) {
      throw new Error('Key exchange already in progress');
    }
    this.keyExchangeInProgress = true;
    
    try {
      console.log("🔓 ALICE: Using keypair with public key:", this.arrayToHex(this.kemKeyPair.publicKey).substring(0, 50) + "...");
      
      const ct = this.hexToArray(ciphertext);
      
      switch (this.currentKemAlgorithm) {
        case "ml-kem-512":
          this.sharedSecret = ml_kem512.decapsulate(ct, this.kemKeyPair.secretKey);
          break;
        case "ml-kem-768":
          this.sharedSecret = ml_kem768.decapsulate(ct, this.kemKeyPair.secretKey);
          break;
        case "ml-kem-1024":
          this.sharedSecret = ml_kem1024.decapsulate(ct, this.kemKeyPair.secretKey);
          break;
      }
      
      console.log("🔓 ALICE: Decapsulation complete with", this.currentKemAlgorithm, "Shared secret:", this.arrayToHex(this.sharedSecret));
      
      return this.sharedSecret;
    } finally {
      this.keyExchangeInProgress = false;
    }
  }

  async encrypt(message: string): Promise<string> {
    if (!this.sharedSecret) {
      throw new Error('No shared secret established');
    }

    console.log("🔒 Encrypting with shared secret:", this.arrayToHex(this.sharedSecret));

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

    console.log("🔓 Decrypting with shared secret:", this.arrayToHex(this.sharedSecret));

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

  reset(): void {
    console.log("🔄 Resetting PQC state");
    this.kemKeyPair = null;
    this.dsaKeyPair = null;
    this.sharedSecret = null;
    this.keyExchangeInProgress = false;
    this.currentKemAlgorithm = "ml-kem-768";
    this.currentSignatureAlgorithm = "ml-dsa-65";
  }

  hasKeyPair(): boolean {
    return this.kemKeyPair !== null;
  }

  hasSharedSecret(): boolean {
    return this.sharedSecret !== null;
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

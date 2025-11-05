// AI Pipeline: Cache Stage
import crypto from "crypto";

export class ServerAnalysisCache {
  static cache: Map<string, any> = new Map();
  static TTL = 1000 * 60 * 60; // 1 saat

  static generateHash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  static get(hash: string): any | null {
    const entry = this.cache.get(hash);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(hash);
      return null;
    }
    return entry;
  }

  static set(hash: string, value: any) {
    this.cache.set(hash, { ...value, timestamp: Date.now() });
  }
}

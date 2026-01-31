import { safeStorage } from "electron";
import Store from "electron-store";

interface PasswordStoreSchema {
  passwords: Record<string, string>; // connectionName -> base64 encoded encrypted password
}

// Lazy-initialized store
let _store: Store<PasswordStoreSchema> | null = null;

function getStore(): Store<PasswordStoreSchema> {
  if (!_store) {
    _store = new Store<PasswordStoreSchema>({
      name: "dbview-passwords",
      defaults: {
        passwords: {},
      },
    });
  }
  return _store;
}

/**
 * PasswordStore - Securely stores passwords using Electron's safeStorage
 *
 * Uses Electron's built-in safeStorage API which provides:
 * - macOS: Keychain (without prompts for Electron apps)
 * - Windows: DPAPI
 * - Linux: Secret Service API or libsecret
 *
 * Encrypted passwords are stored in electron-store as base64 strings.
 */
export class PasswordStore {
  /**
   * Check if encryption is available
   */
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Get password for a connection
   */
  async getPassword(connectionName: string): Promise<string | null> {
    try {
      const passwords = getStore().get("passwords", {});
      const encryptedBase64 = passwords[connectionName];

      if (!encryptedBase64) {
        return null;
      }

      if (!safeStorage.isEncryptionAvailable()) {
        console.warn("Encryption not available, returning null");
        return null;
      }

      const encryptedBuffer = Buffer.from(encryptedBase64, "base64");
      return safeStorage.decryptString(encryptedBuffer);
    } catch (error) {
      console.error(`Failed to get password for ${connectionName}:`, error);
      return null;
    }
  }

  /**
   * Store password for a connection
   */
  async setPassword(connectionName: string, password: string): Promise<void> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("Encryption is not available on this system");
      }

      const encryptedBuffer = safeStorage.encryptString(password);
      const encryptedBase64 = encryptedBuffer.toString("base64");

      const passwords = getStore().get("passwords", {});
      passwords[connectionName] = encryptedBase64;
      getStore().set("passwords", passwords);
    } catch (error) {
      console.error(`Failed to set password for ${connectionName}:`, error);
      throw new Error(`Failed to store password: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete password for a connection
   */
  async deletePassword(connectionName: string): Promise<boolean> {
    try {
      const passwords = getStore().get("passwords", {});

      if (!(connectionName in passwords)) {
        return false;
      }

      delete passwords[connectionName];
      getStore().set("passwords", passwords);
      return true;
    } catch (error) {
      console.error(`Failed to delete password for ${connectionName}:`, error);
      return false;
    }
  }

  /**
   * Check if a password exists for a connection
   */
  async hasPassword(connectionName: string): Promise<boolean> {
    const passwords = getStore().get("passwords", {});
    return connectionName in passwords;
  }

  /**
   * Get all stored connection names (for cleanup purposes)
   */
  async getAllStoredConnectionNames(): Promise<string[]> {
    try {
      const passwords = getStore().get("passwords", {});
      return Object.keys(passwords);
    } catch (error) {
      console.error("Failed to get stored connection names:", error);
      return [];
    }
  }

  /**
   * Clear all stored passwords (use with caution)
   */
  async clearAllPasswords(): Promise<void> {
    getStore().set("passwords", {});
  }
}

// Export singleton instance
export const passwordStore = new PasswordStore();

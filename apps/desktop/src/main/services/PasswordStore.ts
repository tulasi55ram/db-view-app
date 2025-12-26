import keytar from "keytar";

const SERVICE_NAME = "dbview-desktop";

/**
 * PasswordStore - Securely stores passwords in the OS keychain
 *
 * Uses keytar which provides:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service API (libsecret)
 */
export class PasswordStore {
  /**
   * Get password for a connection
   */
  async getPassword(connectionName: string): Promise<string | null> {
    try {
      return await keytar.getPassword(SERVICE_NAME, connectionName);
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
      await keytar.setPassword(SERVICE_NAME, connectionName, password);
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
      return await keytar.deletePassword(SERVICE_NAME, connectionName);
    } catch (error) {
      console.error(`Failed to delete password for ${connectionName}:`, error);
      return false;
    }
  }

  /**
   * Check if a password exists for a connection
   */
  async hasPassword(connectionName: string): Promise<boolean> {
    const password = await this.getPassword(connectionName);
    return password !== null;
  }

  /**
   * Get all stored connection names (for cleanup purposes)
   */
  async getAllStoredConnectionNames(): Promise<string[]> {
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      return credentials.map((c) => c.account);
    } catch (error) {
      console.error("Failed to get stored connection names:", error);
      return [];
    }
  }

  /**
   * Clear all stored passwords (use with caution)
   */
  async clearAllPasswords(): Promise<void> {
    const names = await this.getAllStoredConnectionNames();
    for (const name of names) {
      await this.deletePassword(name);
    }
  }
}

// Export singleton instance
export const passwordStore = new PasswordStore();

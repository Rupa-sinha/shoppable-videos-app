/**
 * Utility: Session Management
 *
 * Handles OAuth session storage and retrieval
 */

const sessions = new Map();

export class SessionStorage {
  /**
   * Store session after OAuth
   */
  static async storeSession(sessionId, shop, accessToken, expiresAt) {
    sessions.set(sessionId, {
      shop,
      accessToken,
      expiresAt,
      createdAt: Date.now(),
    });
  }

  /**
   * Retrieve session by ID
   */
  static async loadSession(sessionId) {
    const session = sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check expiration (default 1 hour)
    if (Date.now() > session.expiresAt) {
      sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Delete session (on logout or uninstall)
   */
  static async deleteSession(sessionId) {
    sessions.delete(sessionId);
  }

  /**
   * Delete all sessions for a shop
   */
  static async deleteShopSessions(shop) {
    for (const [sessionId, session] of sessions.entries()) {
      if (session.shop === shop) {
        sessions.delete(sessionId);
      }
    }
  }
}

const SESSION_STORAGE_KEY = 'app_session_id';
const SESSION_DURATION = 24 * 60 * 60 * 1000;

interface SessionInfo {
  sessionId: string;
  startTime: number;
  userId?: string;
}

class SessionManager {
  private sessionInfo: SessionInfo | null = null;

  constructor() {
    this.initializeSession();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private initializeSession(): void {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (stored) {
      try {
        const parsed: SessionInfo = JSON.parse(stored);
        const age = Date.now() - parsed.startTime;

        if (age < SESSION_DURATION) {
          this.sessionInfo = parsed;
          return;
        }
      } catch (error) {
        // Silently fail - session will be recreated
        // Cannot use logger here to avoid circular dependencies
      }
    }

    this.startNewSession();
  }

  private startNewSession(): void {
    this.sessionInfo = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
    };

    this.saveSession();
  }

  private saveSession(): void {
    if (this.sessionInfo) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.sessionInfo));
    }
  }

  public getSessionId(): string {
    if (!this.sessionInfo) {
      this.initializeSession();
    }
    return this.sessionInfo?.sessionId || this.generateSessionId();
  }

  public setUserId(userId: string): void {
    if (this.sessionInfo) {
      this.sessionInfo.userId = userId;
      this.saveSession();
    }
  }

  public clearSession(): void {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    this.startNewSession();
  }

  public getSessionInfo(): SessionInfo | null {
    return this.sessionInfo;
  }
}

export const sessionManager = new SessionManager();

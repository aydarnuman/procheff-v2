// ============================================================================
// NOTIFICATION SERVICE (DISABLED)
// SQLite'a geçişle birlikte notification sistemi geçici olarak devre dışı
// İleride email/webhook bazlı basit bir sistem eklenebilir
// ============================================================================

export interface NotificationPayload {
  jobType: 'new_tender' | 'deadline_approaching' | 'budget_match' | 'daily_digest';
  ihaleId?: string;
  recipientEmail: string;
  channel: 'email' | 'push' | 'in_app' | 'sms';
  templateData: Record<string, any>;
  priority?: number;
  scheduledAt?: Date;
}

export class NotificationService {
  /**
   * Enqueue notification (currently disabled)
   */
  static async enqueue(payload: NotificationPayload): Promise<{ success: boolean; queueId?: string }> {
    console.log('ℹ️ Notification system is disabled (SQLite migration)');
    console.log('   Notification would be sent to:', payload.recipientEmail);
    console.log('   Job type:', payload.jobType);
    return { success: true };
  }

  /**
   * Send notifications for new tenders (currently disabled)
   */
  static async sendNewTenderNotifications(tenders: any[]): Promise<void> {
    if (tenders.length === 0) return;
    console.log(`ℹ️ Would send ${tenders.length} new tender notifications (system disabled)`);
  }

  /**
   * Notify about a new tender (currently disabled)
   */
  static async notifyNewTender(tender: {
    id: string;
    title: string;
    organization?: string;
    organization_city?: string;
    budget?: number;
    deadline_date?: Date | string;
    category?: string;
  }): Promise<void> {
    console.log(`ℹ️ Would notify about new tender: ${tender.title} (system disabled)`);
  }

  /**
   * Send deadline approaching notifications (currently disabled)
   */
  static async sendDeadlineApproachingNotifications(hours: number = 24): Promise<void> {
    console.log(`ℹ️ Would check for deadlines within ${hours} hours (system disabled)`);
  }

  /**
   * Send budget match notifications (currently disabled)
   */
  static async sendBudgetMatchNotifications(minBudget: number, maxBudget: number): Promise<void> {
    console.log(`ℹ️ Would send budget match notifications (${minBudget}-${maxBudget}) (system disabled)`);
  }

  /**
   * Process notification queue (currently disabled)
   */
  static async processQueue(batchSize: number = 10): Promise<void> {
    console.log(`ℹ️ Notification queue processing disabled`);
  }

  private static canReceiveNotification(email: string): Promise<{ allowed: boolean; reason?: string }> {
    return Promise.resolve({ allowed: true });
  }

  private static getTemplateName(jobType: string, channel: string): string {
    return `${jobType}_${channel}`;
  }
}

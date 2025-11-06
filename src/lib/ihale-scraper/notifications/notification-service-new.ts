// ============================================================================
// NOTIFICATION SERVICE
// SQLite'a geçişle birlikte notification sistemi aktif edildi
// Email ve in-app bildirim desteği
// ============================================================================

import { Resend } from 'resend';

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
  private static resend: Resend | null = null;

  /**
   * Initialize Resend client
   */
  private static initResend(): Resend {
    if (!this.resend) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        this.resend = new Resend(apiKey);
      }
    }
    return this.resend!;
  }

  /**
   * Enqueue notification
   */
  static async enqueue(payload: NotificationPayload): Promise<{ success: boolean; queueId?: string }> {
    try {
      console.log('📧 Notification queued:', payload.jobType, 'to', payload.recipientEmail);

      // For now, send immediately (later we can add queue system)
      return await this.sendNotification(payload);
    } catch (error) {
      console.error('❌ Notification enqueue failed:', error);
      return { success: false };
    }
  }

  /**
   * Send notification immediately
   */
  private static async sendNotification(payload: NotificationPayload): Promise<{ success: boolean; queueId?: string }> {
    try {
      switch (payload.channel) {
        case 'email':
          return await this.sendEmail(payload);
        case 'in_app':
          return await this.sendInApp(payload);
        default:
          console.log(`⚠️ Channel ${payload.channel} not implemented yet`);
          return { success: true }; // Don't fail for unsupported channels
      }
    } catch (error) {
      console.error('❌ Notification send failed:', error);
      return { success: false };
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmail(payload: NotificationPayload): Promise<{ success: boolean; queueId?: string }> {
    try {
      const resend = this.initResend();
      if (!resend) {
        console.warn('⚠️ Resend not configured, skipping email');
        return { success: true };
      }

      const subject = this.getEmailSubject(payload);
      const html = this.getEmailTemplate(payload);

      const result = await resend.emails.send({
        from: 'ihaleler@procheff.com',
        to: payload.recipientEmail,
        subject,
        html,
      });

      console.log('✅ Email sent:', result.data?.id);
      return { success: true, queueId: result.data?.id };
    } catch (error) {
      console.error('❌ Email send failed:', error);
      return { success: false };
    }
  }

  /**
   * Send in-app notification (placeholder)
   */
  private static async sendInApp(payload: NotificationPayload): Promise<{ success: boolean; queueId?: string }> {
    // TODO: Implement in-app notification storage
    console.log('📱 In-app notification:', payload.jobType);
    return { success: true };
  }

  /**
   * Get email subject
   */
  private static getEmailSubject(payload: NotificationPayload): string {
    switch (payload.jobType) {
      case 'new_tender':
        return `🆕 Yeni İhale: ${payload.templateData.title || 'Bilinmeyen'}`;
      case 'deadline_approaching':
        return `⏰ İhale Son Tarihi Yaklaşıyor: ${payload.templateData.title || 'Bilinmeyen'}`;
      case 'budget_match':
        return `💰 Bütçe Eşleşmesi: ${payload.templateData.title || 'Bilinmeyen'}`;
      case 'daily_digest':
        return '📊 Günlük İhale Özeti';
      default:
        return 'İhale Bildirimi';
    }
  }

  /**
   * Get email template
   */
  private static getEmailTemplate(payload: NotificationPayload): string {
    const { templateData } = payload;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Procheff İhale Bildirimi</h1>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2>${templateData.title || 'İhale Başlığı'}</h2>
          <p><strong>Kurum:</strong> ${templateData.organization || 'Bilinmeyen'}</p>
          <p><strong>Şehir:</strong> ${templateData.organization_city || 'Bilinmeyen'}</p>
          ${templateData.budget ? `<p><strong>Bütçe:</strong> ₺${templateData.budget.toLocaleString('tr-TR')}</p>` : ''}
          ${templateData.deadline_date ? `<p><strong>Son Tarih:</strong> ${new Date(templateData.deadline_date).toLocaleDateString('tr-TR')}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://procheff.com'}/ihale-robotu"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Detayları İncele
          </a>
        </div>

        <p style="color: #666; font-size: 12px;">
          Bu bildirim Procheff İhale Takip Sistemi tarafından gönderilmiştir.
        </p>
      </div>
    `;
  }

  /**
   * Send notifications for new tenders
   */
  static async sendNewTenderNotifications(tenders: any[]): Promise<void> {
    if (tenders.length === 0) return;

    console.log(`📧 Sending ${tenders.length} new tender notifications...`);

    // Get notification preferences (for now, use default admin email)
    const adminEmail = process.env.SCRAPER_ALERT_EMAIL || 'admin@procheff.com';

    for (const tender of tenders) {
      try {
        await this.enqueue({
          jobType: 'new_tender',
          ihaleId: tender.source_id,
          recipientEmail: adminEmail,
          channel: 'email',
          templateData: {
            title: tender.title,
            organization: tender.organization,
            organization_city: tender.organization_city,
            budget: tender.budget,
            deadline_date: tender.deadline_date,
          },
          priority: 1,
        });
      } catch (error) {
        console.error(`❌ Notification failed for ${tender.title}:`, error);
      }
    }
  }

  /**
   * Notify about a new tender
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
    const adminEmail = process.env.SCRAPER_ALERT_EMAIL || 'admin@procheff.com';

    await this.enqueue({
      jobType: 'new_tender',
      ihaleId: tender.id,
      recipientEmail: adminEmail,
      channel: 'email',
      templateData: {
        title: tender.title,
        organization: tender.organization,
        organization_city: tender.organization_city,
        budget: tender.budget,
        deadline_date: tender.deadline_date,
      },
      priority: 1,
    });
  }

  /**
   * Send deadline approaching notifications
   */
  static async sendDeadlineApproachingNotifications(hours: number = 24): Promise<void> {
    console.log(`⏰ Checking for deadlines within ${hours} hours...`);

    // TODO: Query database for tenders with approaching deadlines
    // For now, just log
    console.log(`📧 Would check database for tenders expiring in ${hours} hours`);
  }

  /**
   * Send budget match notifications
   */
  static async sendBudgetMatchNotifications(minBudget: number, maxBudget: number): Promise<void> {
    console.log(`💰 Checking for budget matches between ${minBudget} - ${maxBudget}...`);

    // TODO: Query database for tenders in budget range
    console.log(`📧 Would check database for tenders in budget range`);
  }

  /**
   * Process notification queue (placeholder)
   */
  static async processQueue(batchSize: number = 10): Promise<void> {
    console.log(`📋 Processing notification queue (batch size: ${batchSize})...`);
    // TODO: Implement queue processing
  }

  private static canReceiveNotification(email: string): Promise<{ allowed: boolean; reason?: string }> {
    return Promise.resolve({ allowed: true });
  }

  private static getTemplateName(jobType: string, channel: string): string {
    return `${jobType}_${channel}`;
  }
}
// ============================================================================
// ENTERPRISE NOTIFICATION SERVICE
// Queue-based, rate-limited, template-driven notification system
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

export interface NotificationPayload {
  jobType: 'new_tender' | 'deadline_approaching' | 'budget_match' | 'daily_digest';
  ihaleId?: string;
  recipientEmail: string;
  channel: 'email' | 'push' | 'in_app' | 'sms';
  templateData: Record<string, any>;
  priority?: number; // 1-10 (1 = highest)
  scheduledAt?: Date;
}

export class NotificationService {
  /**
   * Enqueue notification (adds to queue for processing)
   */
  static async enqueue(payload: NotificationPayload): Promise<{ success: boolean; queueId?: string }> {
    try {
      // 1. Check if user can receive notification
      const canReceive = await this.canReceiveNotification(payload.recipientEmail);
      if (!canReceive.allowed) {
        console.log(`❌ Notification blocked: ${canReceive.reason}`);
        return { success: false };
      }

      // 2. Get template name
      const templateName = this.getTemplateName(payload.jobType, payload.channel);

      // 3. Insert into queue
      const { data, error } = await supabase
        .from('notification_queue')
        .insert({
          job_type: payload.jobType,
          priority: payload.priority || 5,
          ihale_id: payload.ihaleId,
          recipient_email: payload.recipientEmail,
          channel: payload.channel,
          template_name: templateName,
          template_data: payload.templateData,
          scheduled_at: payload.scheduledAt || new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Queue insert error:', error);
        return { success: false };
      }

      console.log(`✅ Notification queued: ${data.id}`);
      return { success: true, queueId: data.id };
    } catch (error) {
      console.error('❌ Enqueue error:', error);
      return { success: false };
    }
  }

  /**
   * Process notification queue (dequeue and send)
   */
  static async processQueue(batchSize: number = 10): Promise<void> {
    try {
      // Dequeue notifications
      const { data: jobs, error } = await supabase.rpc('dequeue_notifications', {
        p_batch_size: batchSize,
      });

      if (error || !jobs || jobs.length === 0) {
        console.log('📭 No pending notifications');
        return;
      }

      console.log(`📬 Processing ${jobs.length} notifications...`);

      // Process each job
      for (const job of jobs) {
        await this.sendNotification(job);
      }
    } catch (error) {
      console.error('❌ Queue processing error:', error);
    }
  }

  /**
   * Send notification (handles actual delivery)
   */
  private static async sendNotification(job: any): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. Get template
      const template = await this.getTemplate(job.template_name);
      if (!template) {
        throw new Error(`Template not found: ${job.template_name}`);
      }

      // 2. Render template
      const rendered = this.renderTemplate(template, job.template_data);

      // 3. Send via channel
      let success = false;
      switch (job.channel) {
        case 'email':
          success = await this.sendEmail(job.recipient_email, rendered);
          break;
        case 'push':
          success = await this.sendPush(job.recipient_email, rendered);
          break;
        case 'in_app':
          success = await this.sendInApp(job.recipient_email, rendered, job.ihale_id);
          break;
        case 'sms':
          success = await this.sendSMS(job.recipient_email, rendered);
          break;
      }

      // 4. Update queue status
      if (success) {
        await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Increment rate limit counter
        await supabase.rpc('increment_notification_count', {
          p_user_email: job.recipient_email,
          p_channel: job.channel,
        });

        console.log(`✅ Sent ${job.channel} to ${job.recipient_email} (${Date.now() - startTime}ms)`);
      } else {
        throw new Error('Delivery failed');
      }
    } catch (error: any) {
      console.error(`❌ Send error (${job.id}):`, error.message);

      // Retry logic
      const retryCount = (job.retry_count || 0) + 1;
      if (retryCount <= job.max_retries) {
        const nextRetryDelay = Math.pow(2, retryCount) * 60 * 1000; // Exponential: 2min, 4min, 8min
        await supabase
          .from('notification_queue')
          .update({
            status: 'pending',
            retry_count: retryCount,
            next_retry_at: new Date(Date.now() + nextRetryDelay).toISOString(),
            error_message: error.message,
          })
          .eq('id', job.id);

        console.log(`🔁 Retry ${retryCount}/${job.max_retries} scheduled in ${nextRetryDelay / 60000} min`);
      } else {
        // Max retries reached
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
            error_stack: error.stack,
          })
          .eq('id', job.id);

        console.error(`💀 Max retries reached for ${job.id}`);
      }
    }
  }

  /**
   * Check if user can receive notification (rate limiting)
   */
  private static async canReceiveNotification(email: string): Promise<{ allowed: boolean; reason?: string }> {
    const { data, error } = await supabase.rpc('can_receive_notification', {
      p_user_email: email,
    });

    if (error || !data) {
      return { allowed: false, reason: 'Subscription check failed' };
    }

    if (!data) {
      return { allowed: false, reason: 'Rate limit reached or quiet hours' };
    }

    return { allowed: true };
  }

  /**
   * Get template from database
   */
  private static async getTemplate(templateName: string): Promise<any> {
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('template_name', templateName)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Template fetch error:', error);
      return null;
    }

    return data;
  }

  /**
   * Render template with data
   */
  private static renderTemplate(template: any, data: Record<string, any>): any {
    let subject = template.subject_template || '';
    let body = template.body_template || '';
    let actionUrl = template.action_url_template || '';

    // Replace {{variables}}
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, String(value));
      body = body.replace(regex, String(value));
      actionUrl = actionUrl.replace(regex, String(value));
    }

    return {
      subject,
      body,
      actionUrl,
    };
  }

  /**
   * Send email (Resend)
   */
  private static async sendEmail(to: string, rendered: any): Promise<boolean> {
    try {
      // Use Resend API
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'İhaleler <ihaleler@procheff.com>',
          to: [to],
          subject: rendered.subject,
          html: rendered.body,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Resend error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  /**
   * Send push notification (Web Push API)
   */
  private static async sendPush(userEmail: string, rendered: any): Promise<boolean> {
    // TODO: Implement Web Push API
    // Requires push subscription storage
    console.log('🔔 Push notification:', userEmail, rendered.subject);
    return true; // Placeholder
  }

  /**
   * Send in-app notification
   */
  private static async sendInApp(userEmail: string, rendered: any, ihaleId?: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('notifications').insert({
        ihale_id: ihaleId,
        user_email: userEmail,
        notification_type: 'new_tender',
        channel: 'in_app',
        title: rendered.subject,
        message: rendered.body,
        action_url: rendered.actionUrl,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      return !error;
    } catch (error) {
      console.error('In-app notification error:', error);
      return false;
    }
  }

  /**
   * Send SMS (Twilio)
   */
  private static async sendSMS(userEmail: string, rendered: any): Promise<boolean> {
    // TODO: Implement Twilio SMS
    console.log('📱 SMS notification:', userEmail, rendered.body);
    return true; // Placeholder
  }

  /**
   * Get template name based on type and channel
   */
  private static getTemplateName(jobType: string, channel: string): string {
    return `${jobType}_${channel}`;
  }

  /**
   * Send new tender notification to all subscribers
   */
  static async notifyNewTender(ihale: any): Promise<void> {
    try {
      // Get all active subscribers interested in this tender
      const { data: subscribers } = await supabase
        .from('notification_subscriptions')
        .select('*')
        .eq('is_active', true)
        .contains('subscribed_categories', [ihale.category || 'catering']);

      if (!subscribers || subscribers.length === 0) {
        console.log('No subscribers for this tender');
        return;
      }

      console.log(`📢 Notifying ${subscribers.length} subscribers...`);

      for (const sub of subscribers) {
        // Check filters
        if (!this.matchesFilters(ihale, sub)) {
          continue;
        }

        // Enqueue for each enabled channel
        const channels = [];
        if (sub.email_enabled) channels.push('email');
        if (sub.push_enabled) channels.push('push');
        if (sub.in_app_enabled) channels.push('in_app');

        for (const channel of channels) {
          await this.enqueue({
            jobType: 'new_tender',
            ihaleId: ihale.id,
            recipientEmail: sub.user_email,
            channel: channel as any,
            templateData: {
              tenderTitle: ihale.title,
              tenderOrganization: ihale.organization,
              tenderBudget: ihale.budget?.toLocaleString('tr-TR'),
              tenderDeadline: ihale.deadline_date,
              tenderId: ihale.id,
              actionUrl: `https://procheff.com/ihale-takip/${ihale.id}`,
              unsubscribeUrl: `https://procheff.com/unsubscribe?email=${sub.user_email}`,
            },
            priority: ihale.budget && ihale.budget > 1000000 ? 2 : 5, // High priority for large budgets
          });
        }
      }
    } catch (error) {
      console.error('Notify new tender error:', error);
    }
  }

  /**
   * Check if tender matches subscriber filters
   */
  private static matchesFilters(ihale: any, subscription: any): boolean {
    // Budget filter
    if (subscription.min_budget && ihale.budget < subscription.min_budget) {
      return false;
    }
    if (subscription.max_budget && ihale.budget > subscription.max_budget) {
      return false;
    }

    // City filter
    if (subscription.interested_cities && subscription.interested_cities.length > 0) {
      if (!ihale.organization_city || !subscription.interested_cities.includes(ihale.organization_city)) {
        return false;
      }
    }

    // Kisi sayisi filter
    if (subscription.min_kisi_sayisi && ihale.kisi_sayisi < subscription.min_kisi_sayisi) {
      return false;
    }

    return true;
  }
}

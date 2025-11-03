-- ============================================================================
-- NOTIFICATION SYSTEM ENHANCEMENTS
-- Version: 2.0
-- Enterprise-grade bildirim sistemi
-- ============================================================================

-- ============================================================================
-- 1. NOTIFICATION QUEUE (Job Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Job Metadata
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('new_tender', 'deadline_approaching', 'budget_match', 'daily_digest')),
  priority INT DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest

  -- Payload
  ihale_id UUID REFERENCES ihale_listings(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'push', 'in_app', 'sms')),
  template_name VARCHAR(100) NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),

  -- Timing
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Retry logic
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_notification_queue_recipient ON notification_queue(recipient_email);
CREATE INDEX idx_notification_queue_priority ON notification_queue(priority DESC, scheduled_at ASC);

-- ============================================================================
-- 2. USER SUBSCRIPTION MODEL
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User identification
  user_id UUID, -- Future: auth integration
  user_email VARCHAR(255) NOT NULL UNIQUE,

  -- Subscription status
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ,
  verification_token VARCHAR(100),

  -- Category subscriptions (multi-select)
  subscribed_categories TEXT[] DEFAULT ARRAY['catering']::TEXT[], -- ['catering', 'construction', 'it']

  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,

  -- Filters
  min_budget DECIMAL(15,2),
  max_budget DECIMAL(15,2),
  min_kisi_sayisi INT,
  interested_cities TEXT[],
  interested_organizations TEXT[], -- Kurum filtresi

  -- Rate limiting
  daily_notification_limit INT DEFAULT 10,
  notifications_sent_today INT DEFAULT 0,
  last_notification_date DATE,

  -- Digest preferences
  enable_daily_digest BOOLEAN DEFAULT true,
  digest_time TIME DEFAULT '09:00',
  digest_days INT[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri (1=Monday)

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_email ON notification_subscriptions(user_email);
CREATE INDEX idx_subscriptions_active ON notification_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX idx_subscriptions_categories ON notification_subscriptions USING GIN(subscribed_categories);

-- Trigger: Reset daily notification count
CREATE OR REPLACE FUNCTION reset_daily_notification_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_notification_date < CURRENT_DATE THEN
    NEW.notifications_sent_today = 0;
    NEW.last_notification_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reset_daily_count
  BEFORE UPDATE ON notification_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION reset_daily_notification_count();

-- ============================================================================
-- 3. NOTIFICATION TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template identification
  template_name VARCHAR(100) NOT NULL UNIQUE,
  template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('new_tender', 'deadline_approaching', 'budget_match', 'daily_digest')),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'push', 'in_app', 'sms')),

  -- Template content
  subject_template TEXT, -- Email subject / Push title
  body_template TEXT NOT NULL, -- Supports {{variables}}
  action_url_template TEXT, -- CTA link

  -- Metadata
  variables JSONB DEFAULT '[]', -- ["tenderTitle", "tenderBudget", ...]
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_name, channel)
);

CREATE INDEX idx_templates_name ON notification_templates(template_name);
CREATE INDEX idx_templates_type ON notification_templates(template_type);

-- ============================================================================
-- 4. NOTIFICATION DELIVERY LOG (Enhanced)
-- ============================================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES notification_queue(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS template_name VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_attempt INT DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_queue ON notifications(queue_id);
CREATE INDEX IF NOT EXISTS idx_notifications_delivered ON notifications(delivered_at) WHERE delivered_at IS NOT NULL;

-- ============================================================================
-- 5. RATE LIMITING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_email VARCHAR(255) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Counters
  total_notifications INT DEFAULT 0,
  email_sent INT DEFAULT 0,
  push_sent INT DEFAULT 0,
  in_app_sent INT DEFAULT 0,

  -- Status
  limit_reached_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_email, date)
);

CREATE INDEX idx_rate_limits_user_date ON notification_rate_limits(user_email, date);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function: Check if user can receive notification
CREATE OR REPLACE FUNCTION can_receive_notification(
  p_user_email VARCHAR(255),
  p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS BOOLEAN AS $$
DECLARE
  v_subscription RECORD;
  v_current_hour TIME;
  v_current_day INT;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM notification_subscriptions
  WHERE user_email = p_user_email AND is_active = true;

  IF NOT FOUND THEN
    RETURN FALSE; -- No subscription
  END IF;

  -- Check daily limit
  IF v_subscription.notifications_sent_today >= v_subscription.daily_notification_limit THEN
    RETURN FALSE; -- Limit reached
  END IF;

  -- Check quiet hours
  IF v_subscription.quiet_hours_enabled THEN
    v_current_hour := p_current_time::TIME;
    IF v_subscription.quiet_hours_start < v_subscription.quiet_hours_end THEN
      -- Normal case: 22:00 - 08:00
      IF v_current_hour >= v_subscription.quiet_hours_start
         OR v_current_hour < v_subscription.quiet_hours_end THEN
        RETURN FALSE; -- In quiet hours
      END IF;
    ELSE
      -- Across midnight: 23:00 - 01:00
      IF v_current_hour >= v_subscription.quiet_hours_start
         AND v_current_hour < v_subscription.quiet_hours_end THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment notification count
CREATE OR REPLACE FUNCTION increment_notification_count(
  p_user_email VARCHAR(255),
  p_channel VARCHAR(20)
) RETURNS VOID AS $$
BEGIN
  -- Update rate limits
  INSERT INTO notification_rate_limits (user_email, date, total_notifications)
  VALUES (p_user_email, CURRENT_DATE, 1)
  ON CONFLICT (user_email, date) DO UPDATE
  SET total_notifications = notification_rate_limits.total_notifications + 1;

  -- Update subscription count
  UPDATE notification_subscriptions
  SET notifications_sent_today = notifications_sent_today + 1,
      last_notification_date = CURRENT_DATE
  WHERE user_email = p_user_email;
END;
$$ LANGUAGE plpgsql;

-- Function: Process notification queue (dequeue)
CREATE OR REPLACE FUNCTION dequeue_notifications(p_batch_size INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  job_type VARCHAR(50),
  recipient_email VARCHAR(255),
  channel VARCHAR(20),
  template_name VARCHAR(100),
  template_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  UPDATE notification_queue nq
  SET status = 'processing',
      processing_started_at = NOW()
  WHERE nq.id IN (
    SELECT nq2.id
    FROM notification_queue nq2
    WHERE nq2.status = 'pending'
      AND nq2.scheduled_at <= NOW()
      AND (nq2.next_retry_at IS NULL OR nq2.next_retry_at <= NOW())
    ORDER BY nq2.priority DESC, nq2.scheduled_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    nq.id,
    nq.job_type,
    nq.recipient_email,
    nq.channel,
    nq.template_name,
    nq.template_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. SEED DEFAULT TEMPLATES
-- ============================================================================

-- Email: New Tender
INSERT INTO notification_templates (template_name, template_type, channel, subject_template, body_template, action_url_template, variables)
VALUES (
  'new_tender_email',
  'new_tender',
  'email',
  '🆕 Yeni Catering İhalesi: {{tenderTitle}}',
  '<h2>Yeni İhale Fırsatı</h2>
  <p>Merhaba,</p>
  <p>Kriterlere uygun yeni bir catering ihalesi bulundu:</p>
  <ul>
    <li><strong>İhale:</strong> {{tenderTitle}}</li>
    <li><strong>Kurum:</strong> {{tenderOrganization}}</li>
    <li><strong>Bütçe:</strong> {{tenderBudget}} TL</li>
    <li><strong>Son Başvuru:</strong> {{tenderDeadline}}</li>
  </ul>
  <a href="{{actionUrl}}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">İhaleyi Görüntüle</a>
  <p><small>Bu bildirimi almak istemiyorsanız, <a href="{{unsubscribeUrl}}">aboneliği iptal edin</a>.</small></p>',
  'https://procheff.com/ihale-takip/{{tenderId}}',
  '["tenderTitle", "tenderOrganization", "tenderBudget", "tenderDeadline", "tenderId", "actionUrl", "unsubscribeUrl"]'
) ON CONFLICT (template_name, channel) DO NOTHING;

-- Push: New Tender
INSERT INTO notification_templates (template_name, template_type, channel, subject_template, body_template, action_url_template, variables)
VALUES (
  'new_tender_push',
  'new_tender',
  'push',
  'Yeni İhale: {{tenderOrganization}}',
  '{{tenderTitle}} - {{tenderBudget}} TL',
  'https://procheff.com/ihale-takip/{{tenderId}}',
  '["tenderTitle", "tenderOrganization", "tenderBudget", "tenderId"]'
) ON CONFLICT (template_name, channel) DO NOTHING;

-- In-App: New Tender
INSERT INTO notification_templates (template_name, template_type, channel, subject_template, body_template, action_url_template, variables)
VALUES (
  'new_tender_inapp',
  'new_tender',
  'in_app',
  'Yeni Catering İhalesi',
  '{{tenderTitle}} - {{tenderOrganization}} ({{tenderBudget}} TL)',
  '/ihale-takip/{{tenderId}}',
  '["tenderTitle", "tenderOrganization", "tenderBudget", "tenderId"]'
) ON CONFLICT (template_name, channel) DO NOTHING;

-- Email: Deadline Approaching
INSERT INTO notification_templates (template_name, template_type, channel, subject_template, body_template, action_url_template, variables)
VALUES (
  'deadline_approaching_email',
  'deadline_approaching',
  'email',
  '⏰ Son {{daysLeft}} Gün: {{tenderTitle}}',
  '<h2>İhale Son Tarihi Yaklaşıyor</h2>
  <p>Merhaba,</p>
  <p>Takip ettiğiniz ihalenin son başvuru tarihi yaklaşıyor:</p>
  <ul>
    <li><strong>İhale:</strong> {{tenderTitle}}</li>
    <li><strong>Son Başvuru:</strong> {{tenderDeadline}}</li>
    <li><strong>Kalan Süre:</strong> {{daysLeft}} gün</li>
  </ul>
  <a href="{{actionUrl}}" style="background:#ff5722;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Hemen Başvur</a>',
  'https://procheff.com/ihale-takip/{{tenderId}}',
  '["tenderTitle", "tenderDeadline", "daysLeft", "tenderId", "actionUrl"]'
) ON CONFLICT (template_name, channel) DO NOTHING;

-- Daily Digest
INSERT INTO notification_templates (template_name, template_type, channel, subject_template, body_template, action_url_template, variables)
VALUES (
  'daily_digest_email',
  'daily_digest',
  'email',
  '📊 Günlük İhale Özeti - {{date}}',
  '<h2>Günlük İhale Özeti</h2>
  <p>Merhaba,</p>
  <p>Bugün <strong>{{newTendersCount}}</strong> yeni catering ihalesi bulundu:</p>
  {{tendersList}}
  <a href="{{actionUrl}}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Tüm İhaleleri Gör</a>',
  'https://procheff.com/ihale-takip',
  '["date", "newTendersCount", "tendersList", "actionUrl"]'
) ON CONFLICT (template_name, channel) DO NOTHING;

-- ============================================================================
-- COMPLETED: NOTIFICATION SYSTEM V2.0
-- ============================================================================

COMMENT ON TABLE notification_queue IS 'Job queue for notification delivery (BullMQ alternative)';
COMMENT ON TABLE notification_subscriptions IS 'User subscription preferences and rate limiting';
COMMENT ON TABLE notification_templates IS 'Centralized notification templates for all channels';
COMMENT ON TABLE notification_rate_limits IS 'Daily rate limiting counters per user';

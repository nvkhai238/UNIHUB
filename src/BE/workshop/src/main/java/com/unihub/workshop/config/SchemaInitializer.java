package com.unihub.workshop.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Creates the notifications table on startup if it doesn't exist yet.
 * Needed because ddl-auto=validate requires schema to exist.
 * The @DependsOn("schemaInitializer") on the HibernateCustomizer
 * ensures this runs BEFORE Hibernate validates the schema.
 */
@Slf4j
@Component("schemaInitializer")
@RequiredArgsConstructor
public class SchemaInitializer {

    private final DataSource dataSource;

    @PostConstruct
    public void init() throws Exception {
        log.info("SchemaInitializer: creating notifications table if not exists...");
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            stmt.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    type        VARCHAR(50) NOT NULL,
                    title       VARCHAR(255) NOT NULL,
                    body        TEXT NOT NULL,
                    is_read     BOOLEAN NOT NULL DEFAULT false,
                    data        JSONB,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """);

            stmt.execute("CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, is_read) WHERE is_read = false");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC)");

            try {
                // Thêm các cột cho tính năng mở rộng SMS & Telegram
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)");
                stmt.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(50)");
            } catch (Exception e) {
                log.info("SchemaInitializer: columns phone/telegram_id may already exist or error occurred.", e);
            }

            try {
                stmt.execute("ALTER TABLE workshops ADD COLUMN IF NOT EXISTS pdf_url TEXT");
                stmt.execute("ALTER TABLE workshops ADD COLUMN IF NOT EXISTS ai_summary TEXT");
                stmt.execute("ALTER TABLE workshops ADD COLUMN IF NOT EXISTS ai_summary_status VARCHAR(20) DEFAULT 'NONE'");
                stmt.execute("UPDATE workshops SET ai_summary_status = 'NONE' WHERE ai_summary_status IS NULL");
                log.info("SchemaInitializer: workshop AI summary columns ready.");
            } catch (Exception e) {
                log.info("SchemaInitializer: skipped workshop AI summary columns.");
            }

            try {
                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS refund_requests (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
                        bank_name VARCHAR(255) NOT NULL,
                        bank_account_name VARCHAR(255) NOT NULL,
                        bank_account_number VARCHAR(50) NOT NULL,
                        proof_url TEXT NOT NULL,
                        proof_note TEXT,
                        processed BOOLEAN NOT NULL DEFAULT false,
                        processed_at TIMESTAMPTZ,
                        processed_by_user_id UUID REFERENCES users(id),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """);
                stmt.execute("CREATE INDEX IF NOT EXISTS idx_refund_requests_processed ON refund_requests(processed)");
                stmt.execute("CREATE INDEX IF NOT EXISTS idx_refund_requests_registration ON refund_requests(registration_id)");
                log.info("SchemaInitializer: refund requests table ready.");
            } catch (Exception e) {
                log.info("SchemaInitializer: skipped refund requests schema initialization.");
            }

            try {
                stmt.execute("ALTER PUBLICATION supabase_realtime ADD TABLE notifications;");
                log.info("SchemaInitializer: added notifications to supabase_realtime publication.");
            } catch (Exception e) {
                log.info("SchemaInitializer: skipped adding to supabase_realtime (might not be a Supabase DB or already added).");
            }

            try {
                stmt.execute("ALTER PUBLICATION supabase_realtime ADD TABLE workshops;");
                log.info("SchemaInitializer: added workshops to supabase_realtime publication.");
            } catch (Exception e) {
                log.info("SchemaInitializer: skipped adding workshops to supabase_realtime.");
            }

            try {
                stmt.execute("ALTER PUBLICATION supabase_realtime ADD TABLE refund_requests;");
                log.info("SchemaInitializer: added refund_requests to supabase_realtime publication.");
            } catch (Exception e) {
                log.info("SchemaInitializer: skipped adding refund_requests to supabase_realtime.");
            }

            log.info("SchemaInitializer: notifications table ready.");
        }
    }
}

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

            log.info("SchemaInitializer: notifications table ready.");
        }
    }
}

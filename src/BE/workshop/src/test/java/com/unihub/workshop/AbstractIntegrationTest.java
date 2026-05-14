package com.unihub.workshop;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class AbstractIntegrationTest {

    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("unihub_test")
            .withUsername("test")
            .withPassword("test");

    static final com.redis.testcontainers.RedisContainer redis = new com.redis.testcontainers.RedisContainer(
            com.redis.testcontainers.RedisContainer.DEFAULT_IMAGE_NAME.withTag("7.2-alpine")
    );

    static {
        postgres.start();
        redis.start();
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("spring.batch.job.enabled", () -> "false");
        
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", redis::getFirstMappedPort);
    }

    protected void resetDatabase() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE
                  checkins,
                  payments,
                  notifications,
                  registrations,
                  workshops,
                  users
                RESTART IDENTITY CASCADE
                """);
        stringRedisTemplate.getConnectionFactory().getConnection().serverCommands().flushDb();
    }
}

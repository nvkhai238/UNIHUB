package com.unihub.workshop.module.registration.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StudentRegistrationLockService {

    private static final Logger log = LoggerFactory.getLogger(StudentRegistrationLockService.class);
    private static final Duration LOCK_TTL = Duration.ofSeconds(10);
    private static final String LOCK_PREFIX = "lock:registration:student:";
    private static final DefaultRedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class
    );

    private final StringRedisTemplate redisTemplate;

    public RegistrationLock acquire(String studentEmail, UUID workshopId) {
        String key = buildKey(studentEmail, workshopId);
        String token = UUID.randomUUID().toString();

        try {
            Boolean acquired = redisTemplate.opsForValue().setIfAbsent(key, token, LOCK_TTL);
            return new RegistrationLock(key, token, Boolean.TRUE.equals(acquired), true);
        } catch (RedisConnectionFailureException | RedisSystemException e) {
            log.warn("Redis unavailable while acquiring registration lock {}; continuing without Redis lock", key, e);
            return new RegistrationLock(key, token, true, false);
        }
    }

    private String buildKey(String studentEmail, UUID workshopId) {
        String normalizedEmail = studentEmail == null
                ? "anonymous"
                : studentEmail.trim().toLowerCase(Locale.ROOT);
        return LOCK_PREFIX + normalizedEmail + ":" + workshopId;
    }

    public final class RegistrationLock implements AutoCloseable {
        private final String key;
        private final String token;
        private final boolean acquired;
        private final boolean redisBacked;

        private RegistrationLock(String key, String token, boolean acquired, boolean redisBacked) {
            this.key = key;
            this.token = token;
            this.acquired = acquired;
            this.redisBacked = redisBacked;
        }

        public boolean isAcquired() {
            return acquired;
        }

        @Override
        public void close() {
            if (!acquired || !redisBacked) {
                return;
            }

            try {
                redisTemplate.execute(RELEASE_SCRIPT, List.of(key), token);
            } catch (RedisConnectionFailureException | RedisSystemException e) {
                log.warn("Redis unavailable while releasing registration lock {}", key, e);
            }
        }
    }
}

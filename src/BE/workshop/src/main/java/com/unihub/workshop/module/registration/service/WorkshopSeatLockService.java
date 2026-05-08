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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkshopSeatLockService {

    private static final Logger log = LoggerFactory.getLogger(WorkshopSeatLockService.class);
    private static final Duration LOCK_TTL = Duration.ofSeconds(10);
    private static final Duration MAX_WAIT = Duration.ofSeconds(2);
    private static final long RETRY_DELAY_MILLIS = 50L;
    private static final String LOCK_PREFIX = "lock:registration:workshop:";
    private static final DefaultRedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class
    );

    private final StringRedisTemplate redisTemplate;

    public WorkshopSeatLock acquire(UUID workshopId) {
        String key = LOCK_PREFIX + workshopId;
        String token = UUID.randomUUID().toString();
        long deadline = System.nanoTime() + MAX_WAIT.toNanos();

        while (System.nanoTime() <= deadline) {
            try {
                Boolean acquired = redisTemplate.opsForValue().setIfAbsent(key, token, LOCK_TTL);
                if (Boolean.TRUE.equals(acquired)) {
                    return new WorkshopSeatLock(key, token, true, true);
                }
                sleep(RETRY_DELAY_MILLIS);
            } catch (RedisConnectionFailureException | RedisSystemException e) {
                log.warn("Redis unavailable while acquiring workshop seat lock {}; relying on DB lock", key, e);
                return new WorkshopSeatLock(key, token, true, false);
            }
        }

        return new WorkshopSeatLock(key, token, false, true);
    }

    public final class WorkshopSeatLock implements AutoCloseable {
        private final String key;
        private final String token;
        private final boolean acquired;
        private final boolean redisBacked;

        private WorkshopSeatLock(String key, String token, boolean acquired, boolean redisBacked) {
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
                log.warn("Redis unavailable while releasing workshop seat lock {}", key, e);
            }
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

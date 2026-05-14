package com.unihub.workshop.module.registration.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
public class RegistrationSlidingWindowService {

    private static final String KEY_PREFIX = "rate:registration:";

    private final StringRedisTemplate redisTemplate;
    private final int limit;
    private final Duration window;

    public RegistrationSlidingWindowService(
            StringRedisTemplate redisTemplate,
            @Value("${resilience4j.ratelimiter.instances.registration.limitForPeriod:5}") int limit,
            @Value("${resilience4j.ratelimiter.instances.registration.limitRefreshPeriod:10s}") Duration window
    ) {
        this.redisTemplate = redisTemplate;
        this.limit = limit;
        this.window = window;
    }

    public boolean tryAcquire(String principalKey) {
        long now = System.currentTimeMillis();
        long windowStart = now - window.toMillis();
        String key = KEY_PREFIX + principalKey;
        String member = now + ":" + UUID.randomUUID();
        try {
            redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
            Long current = redisTemplate.opsForZSet().zCard(key);
            if (current != null && current >= limit) {
                redisTemplate.expire(key, window);
                return false;
            }
            redisTemplate.opsForZSet().add(key, member, now);
            redisTemplate.expire(key, window);
            return true;
        } catch (RedisConnectionFailureException | RedisSystemException ex) {
            return true;
        }
    }

    public long retryAfterSeconds() {
        return Math.max(1, window.toSeconds());
    }
}

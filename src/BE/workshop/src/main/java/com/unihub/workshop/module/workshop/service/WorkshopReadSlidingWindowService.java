package com.unihub.workshop.module.workshop.service;

import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class WorkshopReadSlidingWindowService {

    private static final String KEY_PREFIX = "rate:workshop-read:";
    private static final int LIMIT = 30;
    private static final Duration WINDOW = Duration.ofSeconds(10);

    private final StringRedisTemplate redisTemplate;

    public WorkshopReadSlidingWindowService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public boolean tryAcquire(String principalKey) {
        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW.toMillis();
        String key = KEY_PREFIX + principalKey;
        String member = now + ":" + Math.random();
        try {
            redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
            Long current = redisTemplate.opsForZSet().zCard(key);
            if (current != null && current >= LIMIT) {
                redisTemplate.expire(key, WINDOW);
                return false;
            }
            redisTemplate.opsForZSet().add(key, member, now);
            redisTemplate.expire(key, WINDOW);
            return true;
        } catch (RedisConnectionFailureException | RedisSystemException ex) {
            return true;
        }
    }
}

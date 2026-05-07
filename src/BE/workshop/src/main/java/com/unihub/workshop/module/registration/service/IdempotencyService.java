package com.unihub.workshop.module.registration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String IDEMPOTENCY_PREFIX = "idempotency:";

    public Object getCachedResponse(String idempotencyKey) {
        return redisTemplate.opsForValue().get(IDEMPOTENCY_PREFIX + idempotencyKey);
    }

    public void cacheResponse(String idempotencyKey, Object response) {
        redisTemplate.opsForValue().set(IDEMPOTENCY_PREFIX + idempotencyKey, response, Duration.ofHours(24));
    }
}

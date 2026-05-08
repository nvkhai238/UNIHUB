package com.unihub.workshop.module.registration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.registration.dto.RegistrationResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);
    private static final String IDEMPOTENCY_PREFIX = "idem:";
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final Pattern UUID_V4_PATTERN = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    );

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public void validateKey(String idempotencyKey) {
        if (idempotencyKey == null || !UUID_V4_PATTERN.matcher(idempotencyKey).matches()) {
            throw new AppException(
                    ErrorCode.INVALID_IDEMPOTENCY_KEY,
                    "Idempotency-Key must be a UUID v4 value"
            );
        }
    }

    public Optional<RegistrationResponse> getCachedRegistrationResponse(String idempotencyKey) {
        try {
            String cached = redisTemplate.opsForValue().get(IDEMPOTENCY_PREFIX + idempotencyKey);
            if (cached == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(cached, RegistrationResponse.class));
        } catch (RedisConnectionFailureException | RedisSystemException e) {
            log.warn("Redis unavailable while reading idempotency key {}; continuing without cache", idempotencyKey, e);
            return Optional.empty();
        } catch (JsonProcessingException e) {
            log.warn("Invalid cached idempotency payload for key {}; ignoring cache", idempotencyKey, e);
            return Optional.empty();
        }
    }

    public void cacheRegistrationResponse(String idempotencyKey, RegistrationResponse response) {
        try {
            String payload = objectMapper.writeValueAsString(response);
            redisTemplate.opsForValue().set(IDEMPOTENCY_PREFIX + idempotencyKey, payload, CACHE_TTL);
        } catch (RedisConnectionFailureException | RedisSystemException e) {
            log.warn("Redis unavailable while writing idempotency key {}; response will not be cached", idempotencyKey, e);
        } catch (JsonProcessingException e) {
            log.warn("Could not serialize idempotency response for key {}; response will not be cached", idempotencyKey, e);
        }
    }
}

package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.module.payment.dto.CircuitBreakerStatusResponse;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.circuitbreaker.CircuitBreaker.Metrics;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CircuitBreakerStatusService {

    private final CircuitBreakerRegistry circuitBreakerRegistry;

    public CircuitBreakerStatusResponse getPaymentCircuitBreakerStatus() {
        CircuitBreaker circuitBreaker = circuitBreakerRegistry.circuitBreaker("payment");
        Metrics metrics = circuitBreaker.getMetrics();
        return CircuitBreakerStatusResponse.builder()
                .name(circuitBreaker.getName())
                .state(circuitBreaker.getState().name())
                .failureRate(metrics.getFailureRate())
                .slowCallRate(metrics.getSlowCallRate())
                .bufferedCalls(metrics.getNumberOfBufferedCalls())
                .failedCalls(metrics.getNumberOfFailedCalls())
                .slowCalls(metrics.getNumberOfSlowCalls())
                .notPermittedCalls((int) metrics.getNumberOfNotPermittedCalls())
                .build();
    }
}

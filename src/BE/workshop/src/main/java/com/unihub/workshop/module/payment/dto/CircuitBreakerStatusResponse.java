package com.unihub.workshop.module.payment.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CircuitBreakerStatusResponse {
    private String name;
    private String state;
    private float failureRate;
    private float slowCallRate;
    private int bufferedCalls;
    private int failedCalls;
    private int slowCalls;
    private int notPermittedCalls;
}

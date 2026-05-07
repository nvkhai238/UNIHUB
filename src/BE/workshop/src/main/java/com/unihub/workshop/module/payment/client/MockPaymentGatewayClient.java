package com.unihub.workshop.module.payment.client;

import com.unihub.workshop.module.payment.entity.PaymentStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Random;

@Component
public class MockPaymentGatewayClient {

    private final Random random = new Random();

    public PaymentStatus processPayment(String gatewayRef, BigDecimal amount) {
        int chance = random.nextInt(100);
        if (chance < 70) return PaymentStatus.SUCCESS;
        if (chance < 90) return PaymentStatus.FAILED;
        throw new RuntimeException("TIMEOUT");
    }
}

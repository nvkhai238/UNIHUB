package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.payment.client.MockPaymentGatewayClient;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final MockPaymentGatewayClient paymentGatewayClient;

    @CircuitBreaker(name = "payment", fallbackMethod = "paymentFallback")
    @Retry(name = "payment")
    public Payment processPayment(Payment payment) {
        try {
            PaymentStatus status = paymentGatewayClient.processPayment(payment.getGatewayRef(), payment.getAmount());
            payment.setStatus(status);
            payment.setGatewayResponse("{\"status\": \"" + status.name() + "\"}");
        } catch (Exception e) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setGatewayResponse("{\"error\": \"" + e.getMessage() + "\"}");
            paymentRepository.save(payment);
            throw e;
        }
        return paymentRepository.save(payment);
    }

    public Payment paymentFallback(Payment payment, Exception e) {
        throw new AppException(ErrorCode.PAYMENT_UNAVAILABLE, "Payment service is currently unavailable");
    }
}

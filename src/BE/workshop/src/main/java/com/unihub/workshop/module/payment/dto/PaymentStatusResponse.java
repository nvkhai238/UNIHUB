package com.unihub.workshop.module.payment.dto;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
public class PaymentStatusResponse {
    private UUID paymentId;
    private UUID registrationId;
    private UUID workshopId;
    private String workshopTitle;
    private BigDecimal amount;
    private String currency;
    private PaymentStatus paymentStatus;
    private String gatewayReference;
    private String errorMessage;
    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    public static PaymentStatusResponse from(Payment payment) {
        return PaymentStatusResponse.builder()
                .paymentId(payment.getId())
                .registrationId(payment.getRegistration().getId())
                .workshopId(payment.getRegistration().getWorkshop().getId())
                .workshopTitle(payment.getRegistration().getWorkshop().getTitle())
                .amount(payment.getAmount())
                .currency("VND")
                .paymentStatus(payment.getStatus())
                .gatewayReference(payment.getGatewayRef())
                .errorMessage(extractErrorMessage(payment.getGatewayResponse()))
                .createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt())
                .build();
    }

    private static String extractErrorMessage(String gatewayResponse) {
        if (gatewayResponse == null || gatewayResponse.isEmpty()) return null;
        if (gatewayResponse.contains("PENDING_RETRY")) {
            return "Giao dịch đang chờ xử lý lại. Vui lòng kiểm tra sau.";
        }
        return gatewayResponse;
    }
}

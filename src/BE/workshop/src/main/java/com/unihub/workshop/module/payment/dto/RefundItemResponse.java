package com.unihub.workshop.module.payment.dto;

import com.unihub.workshop.module.payment.entity.Payment;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class RefundItemResponse {
    private UUID paymentId;
    private UUID registrationId;
    private UUID workshopId;
    private String workshopTitle;
    private String studentName;
    private String studentCode;
    private String studentEmail;
    private String studentPhone;
    private String telegramId;
    private BigDecimal amount;
    private String paymentCode;
    private ZonedDateTime paidAt;
    private ZonedDateTime refundedAt;

    public static RefundItemResponse from(Payment payment) {
        var registration = payment.getRegistration();
        var workshop = registration.getWorkshop();
        var user = registration.getUser();

        return RefundItemResponse.builder()
                .paymentId(payment.getId())
                .registrationId(registration.getId())
                .workshopId(workshop.getId())
                .workshopTitle(workshop.getTitle())
                .studentName(user.getFullName())
                .studentCode(user.getStudentId())
                .studentEmail(user.getEmail())
                .studentPhone(user.getPhone())
                .telegramId(user.getTelegramId())
                .amount(payment.getAmount())
                .paymentCode(payment.getGatewayRef())
                .paidAt(payment.getCreatedAt())
                .refundedAt(payment.getUpdatedAt())
                .build();
    }
}

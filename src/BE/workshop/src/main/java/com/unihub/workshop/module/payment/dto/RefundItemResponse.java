package com.unihub.workshop.module.payment.dto;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.RefundRequest;
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
    private UUID refundRequestId;
    private Boolean submitted;
    private String bankName;
    private String bankAccountName;
    private String bankAccountNumber;
    private String proofUrl;
    private String proofNote;
    private Boolean processed;
    private ZonedDateTime processedAt;
    private String processedByName;

    public static RefundItemResponse from(Payment payment, RefundRequest refundRequest) {
        if (payment == null) {
            return null;
        }

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
                .refundRequestId(refundRequest != null ? refundRequest.getId() : null)
                .submitted(refundRequest != null)
                .bankName(refundRequest != null ? refundRequest.getBankName() : null)
                .bankAccountName(refundRequest != null ? refundRequest.getBankAccountName() : null)
                .bankAccountNumber(refundRequest != null ? refundRequest.getBankAccountNumber() : null)
                .proofUrl(refundRequest != null ? refundRequest.getProofUrl() : null)
                .proofNote(refundRequest != null ? refundRequest.getProofNote() : null)
                .processed(refundRequest != null && Boolean.TRUE.equals(refundRequest.getProcessed()))
                .processedAt(refundRequest != null ? refundRequest.getProcessedAt() : null)
                .processedByName(refundRequest != null && refundRequest.getProcessedBy() != null ? refundRequest.getProcessedBy().getFullName() : null)
                .build();
    }
}

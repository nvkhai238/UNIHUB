package com.unihub.workshop.module.payment.dto;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.RefundRequest;
import com.unihub.workshop.module.registration.entity.Registration;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class StudentRefundRequestResponse {
    private UUID refundRequestId;
    private UUID registrationId;
    private UUID workshopId;
    private String workshopTitle;
    private BigDecimal amount;
    private String paymentCode;
    private Boolean refundEligible;
    private Boolean submitted;
    private Boolean processed;
    private ZonedDateTime processedAt;
    private String bankName;
    private String bankAccountName;
    private String bankAccountNumber;
    private String proofUrl;
    private String proofNote;

    public static StudentRefundRequestResponse from(
            Registration registration,
            Payment payment,
            RefundRequest refundRequest,
            boolean refundEligible
    ) {
        return StudentRefundRequestResponse.builder()
                .refundRequestId(refundRequest != null ? refundRequest.getId() : null)
                .registrationId(registration.getId())
                .workshopId(registration.getWorkshop().getId())
                .workshopTitle(registration.getWorkshop().getTitle())
                .amount(payment != null ? payment.getAmount() : null)
                .paymentCode(payment != null ? payment.getGatewayRef() : null)
                .refundEligible(refundEligible)
                .submitted(refundRequest != null)
                .processed(refundRequest != null && Boolean.TRUE.equals(refundRequest.getProcessed()))
                .processedAt(refundRequest != null ? refundRequest.getProcessedAt() : null)
                .bankName(refundRequest != null ? refundRequest.getBankName() : null)
                .bankAccountName(refundRequest != null ? refundRequest.getBankAccountName() : null)
                .bankAccountNumber(refundRequest != null ? refundRequest.getBankAccountNumber() : null)
                .proofUrl(refundRequest != null ? refundRequest.getProofUrl() : null)
                .proofNote(refundRequest != null ? refundRequest.getProofNote() : null)
                .build();
    }
}

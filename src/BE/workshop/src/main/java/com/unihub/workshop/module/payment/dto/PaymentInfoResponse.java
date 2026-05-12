package com.unihub.workshop.module.payment.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class PaymentInfoResponse {
    private String paymentCode;
    private BigDecimal amount;
    private String bankName;
    private String accountNumber;
    private String accountName;
}

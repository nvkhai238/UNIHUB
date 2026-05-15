package com.unihub.workshop.module.payment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RefundRequestUpsertRequest {

    @NotBlank
    private String bankName;

    @NotBlank
    private String bankAccountName;

    @NotBlank
    private String bankAccountNumber;

    @NotBlank
    private String proofUrl;

    private String proofNote;
}

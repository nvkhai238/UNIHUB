package com.unihub.workshop.module.payment.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RefundRequestStatusUpdateRequest {

    @NotNull
    private Boolean processed;
}

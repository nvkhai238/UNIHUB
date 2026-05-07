package com.unihub.workshop.module.workshop.dto;

import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class ChangeStatusRequest {

    @NotNull(message = "Status is required")
    private WorkshopStatus status;
}

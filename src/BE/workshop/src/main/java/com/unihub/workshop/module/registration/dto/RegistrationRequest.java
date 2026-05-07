package com.unihub.workshop.module.registration.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;

import java.util.UUID;

@Getter
public class RegistrationRequest {
    @NotNull(message = "workshopId is required")
    private UUID workshopId;
}

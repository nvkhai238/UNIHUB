package com.unihub.workshop.module.registration.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class RegistrationRequest {
    @NotNull(message = "workshopId is required")
    private UUID workshopId;
}

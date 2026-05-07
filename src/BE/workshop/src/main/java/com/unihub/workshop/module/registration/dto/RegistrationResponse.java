package com.unihub.workshop.module.registration.dto;

import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class RegistrationResponse {
    private UUID id;
    private UUID workshopId;
    private RegistrationStatus status;
    private String qrCode;
    private ZonedDateTime registeredAt;

    public static RegistrationResponse from(Registration registration) {
        return RegistrationResponse.builder()
                .id(registration.getId())
                .workshopId(registration.getWorkshop().getId())
                .status(registration.getStatus())
                .qrCode(registration.getQrCode())
                .registeredAt(registration.getRegisteredAt())
                .build();
    }
}

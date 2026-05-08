package com.unihub.workshop.module.registration.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RegistrationResponse {
    private UUID id;
    private UUID registrationId;
    private UUID workshopId;
    private UUID userId;
    private String workshopTitle;
    private RegistrationStatus status;
    private String qrCode;
    private ZonedDateTime registeredAt;
    private ZonedDateTime confirmedAt;

    public static RegistrationResponse from(Registration registration) {
        return RegistrationResponse.builder()
                .id(registration.getId())
                .registrationId(registration.getId())
                .workshopId(registration.getWorkshop().getId())
                .userId(registration.getUser().getId())
                .workshopTitle(registration.getWorkshop().getTitle())
                .status(registration.getStatus())
                .qrCode(registration.getQrCode())
                .registeredAt(registration.getRegisteredAt())
                .confirmedAt(registration.getConfirmedAt())
                .build();
    }
}

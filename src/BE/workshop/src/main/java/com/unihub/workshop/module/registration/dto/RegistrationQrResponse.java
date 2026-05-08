package com.unihub.workshop.module.registration.dto;

import com.unihub.workshop.module.registration.entity.Registration;
import lombok.Builder;
import lombok.Getter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class RegistrationQrResponse {
    private UUID registrationId;
    private UUID workshopId;
    private String workshopTitle;
    private String qrCode;
    private String qrCodeImage;
    private ZonedDateTime confirmedAt;

    public static RegistrationQrResponse from(Registration registration, String qrCodeImage) {
        return RegistrationQrResponse.builder()
                .registrationId(registration.getId())
                .workshopId(registration.getWorkshop().getId())
                .workshopTitle(registration.getWorkshop().getTitle())
                .qrCode(registration.getQrCode())
                .qrCodeImage(qrCodeImage)
                .confirmedAt(registration.getConfirmedAt())
                .build();
    }
}

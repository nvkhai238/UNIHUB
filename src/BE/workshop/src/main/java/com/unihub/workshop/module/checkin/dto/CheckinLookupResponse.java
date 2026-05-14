package com.unihub.workshop.module.checkin.dto;

import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class CheckinLookupResponse {
    private boolean found;
    private boolean eligible;
    private String qrCode;
    private UUID registrationId;
    private RegistrationStatus registrationStatus;
    private String fullName;
    private String studentId;
    private UUID workshopId;
    private String workshopTitle;
    private ZonedDateTime workshopStartTime;
    private String status;
    private String message;
}

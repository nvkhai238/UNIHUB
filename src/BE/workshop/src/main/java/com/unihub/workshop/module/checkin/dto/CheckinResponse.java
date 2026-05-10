package com.unihub.workshop.module.checkin.dto;

import com.unihub.workshop.module.checkin.entity.Checkin;
import lombok.Builder;
import lombok.Getter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class CheckinResponse {
    private UUID id;
    private UUID registrationId;
    private UUID userId;
    private String studentId;
    private String fullName;
    private UUID workshopId;
    private String workshopTitle;
    private ZonedDateTime checkedInAt;
    private ZonedDateTime syncedAt;
    private String deviceId;

    public static CheckinResponse from(Checkin checkin) {
        return CheckinResponse.builder()
                .id(checkin.getId())
                .registrationId(checkin.getRegistration().getId())
                .userId(checkin.getRegistration().getUser().getId())
                .studentId(checkin.getRegistration().getUser().getStudentId())
                .fullName(checkin.getRegistration().getUser().getFullName())
                .workshopId(checkin.getRegistration().getWorkshop().getId())
                .workshopTitle(checkin.getRegistration().getWorkshop().getTitle())
                .checkedInAt(checkin.getCheckedInAt())
                .syncedAt(checkin.getSyncedAt())
                .deviceId(checkin.getDeviceId())
                .build();
    }
}

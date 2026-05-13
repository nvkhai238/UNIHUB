package com.unihub.workshop.module.registration.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.workshop.entity.Workshop;
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
    private ZonedDateTime workshopStartTime;
    private ZonedDateTime workshopEndTime;
    private RegistrationStatus status;
    private String qrCode;
    private ZonedDateTime registeredAt;
    private ZonedDateTime confirmedAt;
    private Boolean canCancel;
    private String cancellationUnavailableReason;

    // Thêm các trường của Sinh viên để hiển thị bên Admin
    private String studentName;
    private String studentCode;
    private String studentEmail;

    public static RegistrationResponse from(Registration registration) {
        Workshop workshop = registration.getWorkshop();
        boolean isAlreadyCancelled = registration.getStatus() == RegistrationStatus.CANCELLED;
        boolean canCancel = !isAlreadyCancelled;

        String cancellationUnavailableReason = null;
        if (isAlreadyCancelled) {
            cancellationUnavailableReason = "Đăng ký đã được hủy.";
        }

        return RegistrationResponse.builder()
                .id(registration.getId())
                .registrationId(registration.getId())
                .workshopId(workshop.getId())
                .userId(registration.getUser().getId())
                .workshopTitle(workshop.getTitle())
                .workshopStartTime(workshop.getStartTime())
                .workshopEndTime(workshop.getEndTime())
                .status(registration.getStatus())
                .qrCode(registration.getQrCode())
                .registeredAt(registration.getRegisteredAt())
                .confirmedAt(registration.getConfirmedAt())
                .canCancel(canCancel)
                .cancellationUnavailableReason(cancellationUnavailableReason)
                .studentName(registration.getUser().getFullName())
                .studentCode(registration.getUser().getStudentId())
                .studentEmail(registration.getUser().getEmail())
                .build();
    }
}

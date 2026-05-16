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

import java.math.BigDecimal;
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
    private String studentName;
    private String studentCode;
    private String studentEmail;

    public static RegistrationResponse from(Registration registration) {
        Workshop workshop = registration.getWorkshop();
        boolean isCancelled = registration.getStatus() == RegistrationStatus.CANCELLED;
        boolean isPaidWorkshop = workshop.getPrice() != null && workshop.getPrice().compareTo(BigDecimal.ZERO) > 0;
        boolean isPendingPayment = registration.getStatus() == RegistrationStatus.PENDING;

        boolean isTooCloseToStart = workshop.getStartTime() != null &&
                ZonedDateTime.now().plusHours(6).isAfter(workshop.getStartTime());

        boolean canCancel = !isCancelled && (!isPaidWorkshop || isPendingPayment) && !isTooCloseToStart;
        String cancellationUnavailableReason = null;

        if (isCancelled) {
            cancellationUnavailableReason = "Đăng ký đã được hủy.";
        } else if (isTooCloseToStart) {
            cancellationUnavailableReason = "Không thể hủy đăng ký khi workshop sắp diễn ra trong dưới 6 tiếng.";
        } else if (isPaidWorkshop && !isPendingPayment) {
            cancellationUnavailableReason = "Workshop đã thanh toán thành công nên không hỗ trợ sinh viên tự hủy. BTC sẽ xử lý hoàn tiền nếu workshop bị hủy.";
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

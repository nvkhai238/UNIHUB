package com.unihub.workshop.module.checkin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.ZonedDateTime;

@Getter
@Setter
public class SyncRequest {
    @NotBlank(message = "QR code is required")
    private String qrCode;

    @NotNull(message = "Timestamp is required")
    private ZonedDateTime timestamp;

    private String deviceId;
}

package com.unihub.workshop.module.checkin.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Getter
@Builder
public class PreloadResponse {
    private String qrCode;
    private String fullName;
    private UUID workshopId;
}

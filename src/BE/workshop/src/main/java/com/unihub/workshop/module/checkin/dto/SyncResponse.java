package com.unihub.workshop.module.checkin.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Builder
public class SyncResponse {
    private int total;
    private int created;
    private int duplicate;
    private int conflict;
    private int invalid;
    private List<Item> items;

    @Getter
    @Builder
    public static class Item {
        private String qrCode;
        private UUID registrationId;
        private String status;
        private String message;
        private String deviceId;
        private ZonedDateTime checkedInAt;
    }
}

package com.unihub.workshop.module.checkin.dto;

import com.unihub.workshop.module.workshop.entity.Workshop;
import lombok.Builder;
import lombok.Getter;

import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class WorkshopSummaryResponse {
    private UUID id;
    private String title;
    private String room;
    private ZonedDateTime startTime;
    private ZonedDateTime endTime;
    private Integer remainingSeats;

    public static WorkshopSummaryResponse from(Workshop w) {
        return WorkshopSummaryResponse.builder()
                .id(w.getId())
                .title(w.getTitle())
                .room(w.getRoom())
                .startTime(w.getStartTime())
                .endTime(w.getEndTime())
                .remainingSeats(w.getRemainingSeats())
                .build();
    }
}

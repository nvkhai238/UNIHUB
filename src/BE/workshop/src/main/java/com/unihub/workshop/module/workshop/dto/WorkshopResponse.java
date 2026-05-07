package com.unihub.workshop.module.workshop.dto;

import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

@Getter
@Builder
public class WorkshopResponse {
    private UUID id;
    private String title;
    private String description;
    private String speakerName;
    private String speakerBio;
    private String room;
    private String roomLayoutUrl;
    private ZonedDateTime startTime;
    private ZonedDateTime endTime;
    private Integer capacity;
    private Integer remainingSeats;
    private BigDecimal price;
    private WorkshopStatus status;
    private String pdfUrl;
    private String aiSummary;
    private String aiSummaryStatus;
    private UUID createdBy;
    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    public static WorkshopResponse from(Workshop w) {
        return WorkshopResponse.builder()
                .id(w.getId())
                .title(w.getTitle())
                .description(w.getDescription())
                .speakerName(w.getSpeakerName())
                .speakerBio(w.getSpeakerBio())
                .room(w.getRoom())
                .roomLayoutUrl(w.getRoomLayoutUrl())
                .startTime(w.getStartTime())
                .endTime(w.getEndTime())
                .capacity(w.getCapacity())
                .remainingSeats(w.getRemainingSeats())
                .price(w.getPrice())
                .status(w.getStatus())
                .pdfUrl(w.getPdfUrl())
                .aiSummary(w.getAiSummary())
                .aiSummaryStatus(w.getAiSummaryStatus())
                .createdBy(w.getCreatedBy() != null ? w.getCreatedBy().getId() : null)
                .createdAt(w.getCreatedAt())
                .updatedAt(w.getUpdatedAt())
                .build();
    }
}

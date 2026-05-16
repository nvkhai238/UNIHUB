package com.unihub.workshop.module.workshop.dto;

import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * timePhase là trường tính toán (không lưu DB) phản ánh trạng thái thời gian:
 *   UPCOMING  — chưa bắt đầu (now < startTime)
 *   ONGOING   — đang diễn ra (startTime <= now < endTime)
 *   ENDED     — đã kết thúc  (now >= endTime)
 */

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
    /** Trạng thái thời gian: UPCOMING / ONGOING / ENDED (computed, không lưu DB) */
    private String timePhase;

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
                .timePhase(computeTimePhase(w.getStartTime(), w.getEndTime()))
                .build();
    }

    /**
     * Tính timePhase từ startTime và endTime so với thời điểm hiện tại.
     * Không phụ thuộc DB — luôn chính xác theo đồng hồ server.
     */
    private static String computeTimePhase(ZonedDateTime startTime, ZonedDateTime endTime) {
        if (startTime == null || endTime == null) return "UPCOMING";
        ZonedDateTime now = ZonedDateTime.now();
        if (now.isBefore(startTime)) return "UPCOMING";
        if (now.isBefore(endTime))   return "ONGOING";
        return "ENDED";
    }
}

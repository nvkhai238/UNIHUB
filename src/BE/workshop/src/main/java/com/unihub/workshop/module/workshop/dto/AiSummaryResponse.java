package com.unihub.workshop.module.workshop.dto;

import com.unihub.workshop.module.workshop.entity.Workshop;
import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Getter
@Builder
public class AiSummaryResponse {
    private UUID workshopId;
    private String pdfUrl;
    private String aiSummary;
    private String aiSummaryStatus;

    public static AiSummaryResponse from(WorkshopResponse workshop) {
        return AiSummaryResponse.builder()
                .workshopId(workshop.getId())
                .pdfUrl(workshop.getPdfUrl())
                .aiSummary(workshop.getAiSummary())
                .aiSummaryStatus(workshop.getAiSummaryStatus())
                .build();
    }

    public static AiSummaryResponse from(Workshop workshop) {
        return AiSummaryResponse.builder()
                .workshopId(workshop.getId())
                .pdfUrl(workshop.getPdfUrl())
                .aiSummary(workshop.getAiSummary())
                .aiSummaryStatus(workshop.getAiSummaryStatus())
                .build();
    }
}

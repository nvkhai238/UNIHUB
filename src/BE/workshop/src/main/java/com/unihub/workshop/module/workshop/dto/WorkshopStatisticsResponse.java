package com.unihub.workshop.module.workshop.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkshopStatisticsResponse {
    private long totalWorkshops;
    private long totalRegistrations;
    private List<WorkshopRegistrationStat> breakdown;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkshopRegistrationStat {
        private UUID workshopId;
        private String workshopTitle;
        private long registrationsCount;
        private int capacity;
    }
}

package com.unihub.workshop.module.workshop.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkshopStatisticsResponse {
    private long totalWorkshops;
    private long totalRegistrations;
    private long totalConfirmedRegistrations;
    private long totalWaitlistedRegistrations;
    private long totalPendingRegistrations;
    private long totalCancelledRegistrations;
    private long totalCheckins;
    private long successfulPayments;
    private BigDecimal totalRevenue;
    private List<WorkshopRegistrationStat> breakdown;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkshopRegistrationStat {
        private UUID workshopId;
        private String workshopTitle;
        private long registrationsCount;
        private long confirmedCount;
        private long waitlistedCount;
        private long pendingCount;
        private long cancelledCount;
        private long checkinCount;
        private double checkinRate;
        private int capacity;
        private int remainingSeats;
        private BigDecimal revenue;
    }
}

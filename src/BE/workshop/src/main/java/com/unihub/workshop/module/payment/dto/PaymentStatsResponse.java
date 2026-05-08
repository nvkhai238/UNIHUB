package com.unihub.workshop.module.payment.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class PaymentStatsResponse {
    private long totalPayments;
    private BigDecimal totalAmount;
    private String currency;
    private Map<String, StatusBucket> byStatus;
    private String successRate;
    private BigDecimal averageAmount;
    private List<WorkshopPaymentSummary> topWorkshops;
    private Period period;

    @Data
    @Builder
    public static class StatusBucket {
        private long count;
        private BigDecimal amount;
    }

    @Data
    @Builder
    public static class WorkshopPaymentSummary {
        private String workshopId;
        private String title;
        private long totalPayments;
        private long successCount;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    public static class Period {
        private ZonedDateTime from;
        private ZonedDateTime to;
    }
}

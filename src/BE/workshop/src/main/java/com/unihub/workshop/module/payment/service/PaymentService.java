package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.payment.client.MockPaymentGatewayClient;
import com.unihub.workshop.module.payment.dto.PaymentStatsResponse;
import com.unihub.workshop.module.payment.dto.PaymentStatusResponse;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZonedDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final MockPaymentGatewayClient paymentGatewayClient;
    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;
    private final UserRepository userRepository;

    // ─── Original gateway processing ──────────────────────────────────────────────

    @CircuitBreaker(name = "payment", fallbackMethod = "paymentFallback")
    @Retry(name = "payment")
    public Payment processPayment(Payment payment) {
        try {
            PaymentStatus status = paymentGatewayClient.processPayment(payment.getGatewayRef(), payment.getAmount());
            payment.setStatus(status);
            payment.setGatewayResponse("{\"status\": \"" + status.name() + "\"}");
        } catch (Exception e) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setGatewayResponse("{\"error\": \"" + e.getMessage() + "\"}");
            paymentRepository.save(payment);
            throw e;
        }
        return paymentRepository.save(payment);
    }

    public Payment paymentFallback(Payment payment, Exception e) {
        throw new AppException(ErrorCode.PAYMENT_UNAVAILABLE, "Payment service is currently unavailable");
    }

    // ─── Student: get payment status for a registration ──────────────────────────

    @Transactional(readOnly = true)
    public PaymentStatusResponse getPaymentStatus(UUID registrationId) {
        User user = getCurrentUser();
        Registration registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new AppException(ErrorCode.REGISTRATION_NOT_FOUND));

        if (!registration.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your registration");
        }

        Payment payment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Payment not found"));

        return PaymentStatusResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public com.unihub.workshop.module.payment.dto.PaymentInfoResponse getPaymentInfo(UUID registrationId) {
        User user = getCurrentUser();
        Registration registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new AppException(ErrorCode.REGISTRATION_NOT_FOUND));

        if (!registration.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your registration");
        }

        Payment payment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Payment not found"));

        return com.unihub.workshop.module.payment.dto.PaymentInfoResponse.builder()
                .paymentCode(payment.getGatewayRef())
                .amount(payment.getAmount())
                .bankName("MBBank")
                .accountNumber("0123456789")
                .accountName("NGUYEN VAN A")
                .build();
    }

    // ─── Organizer: payment statistics ──────────────────────────────────────────

    @Transactional(readOnly = true)
    public PaymentStatsResponse getPaymentStats(UUID workshopId, PaymentStatus statusFilter, ZonedDateTime from, ZonedDateTime to) {
        // Total payments matching all filters
        long totalPayments = paymentRepository.countFiltered(statusFilter, workshopId, from, to);

        // Breakdown by status (apply workshopId + date filters, iterate each status)
        Map<String, PaymentStatsResponse.StatusBucket> byStatus = new LinkedHashMap<>();
        for (PaymentStatus s : PaymentStatus.values()) {
            // If user specified a status filter, only show that one bucket
            if (statusFilter != null && s != statusFilter) continue;
            BigDecimal sum = paymentRepository.sumAmountFiltered(s, workshopId, from, to);
            long count = paymentRepository.countByStatusFiltered(s, workshopId, from, to);
            byStatus.put(s.name(), PaymentStatsResponse.StatusBucket.builder()
                    .count(count)
                    .amount(sum != null ? sum : BigDecimal.ZERO)
                    .build());
        }

        // Success metrics (always computed with workshopId + date filters)
        BigDecimal totalSuccess = paymentRepository.sumAmountFiltered(PaymentStatus.SUCCESS, workshopId, from, to);
        BigDecimal totalAmount = totalSuccess != null ? totalSuccess : BigDecimal.ZERO;
        long successCount = paymentRepository.countByStatusFiltered(PaymentStatus.SUCCESS, workshopId, from, to);
        String successRate = totalPayments > 0
                ? BigDecimal.valueOf(successCount)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(totalPayments), 2, RoundingMode.HALF_UP)
                        .toPlainString() + "%"
                : "0%";
        BigDecimal averageAmount = totalPayments > 0
                ? totalAmount.divide(BigDecimal.valueOf(totalPayments), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        List<PaymentStatsResponse.WorkshopPaymentSummary> topWorkshops = buildTopWorkshops(workshopId, from, to);

        return PaymentStatsResponse.builder()
                .totalPayments(totalPayments)
                .totalAmount(totalAmount)
                .currency("VND")
                .byStatus(byStatus)
                .successRate(successRate)
                .averageAmount(averageAmount)
                .topWorkshops(topWorkshops)
                .period(PaymentStatsResponse.Period.builder()
                        .from(from != null ? from : ZonedDateTime.now().minusMonths(1))
                        .to(to != null ? to : ZonedDateTime.now())
                        .build())
                .build();
    }

    private List<PaymentStatsResponse.WorkshopPaymentSummary> buildTopWorkshops(UUID workshopIdFilter, ZonedDateTime from, ZonedDateTime to) {
        List<Workshop> workshops;
        if (workshopIdFilter != null) {
            workshops = workshopRepository.findById(workshopIdFilter).map(List::of).orElse(List.of());
        } else {
            workshops = workshopRepository.findAll();
        }

        List<PaymentStatsResponse.WorkshopPaymentSummary> summaries = new ArrayList<>();
        for (Workshop w : workshops) {
            BigDecimal successAmount = paymentRepository.sumAmountFiltered(PaymentStatus.SUCCESS, w.getId(), from, to);
            long successCount = paymentRepository.countByStatusFiltered(PaymentStatus.SUCCESS, w.getId(), from, to);
            long totalCount = paymentRepository.countFiltered(null, w.getId(), from, to);
            if (totalCount > 0) {
                summaries.add(PaymentStatsResponse.WorkshopPaymentSummary.builder()
                        .workshopId(w.getId().toString())
                        .title(w.getTitle())
                        .totalPayments(totalCount)
                        .successCount(successCount)
                        .revenue(successAmount != null ? successAmount : BigDecimal.ZERO)
                        .build());
            }
        }
        summaries.sort((a, b) -> b.getRevenue().compareTo(a.getRevenue()));
        return summaries.stream().limit(5).toList();
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}

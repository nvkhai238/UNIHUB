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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final MockPaymentGatewayClient paymentGatewayClient;
    private final RegistrationRepository registrationRepository;
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
        List<Payment> filteredPayments = paymentRepository.findAll().stream()
                .filter(payment -> matchesPaymentFilters(payment, statusFilter, workshopId, from, to))
                .toList();

        long totalPayments = filteredPayments.size();
        BigDecimal totalAmount = sumPayments(filteredPayments);

        Map<String, PaymentStatsResponse.StatusBucket> byStatus = new LinkedHashMap<>();
        for (PaymentStatus s : PaymentStatus.values()) {
            if (statusFilter != null && s != statusFilter) continue;
            List<Payment> statusPayments = filteredPayments.stream()
                    .filter(payment -> payment.getStatus() == s)
                    .toList();
            byStatus.put(s.name(), PaymentStatsResponse.StatusBucket.builder()
                    .count(statusPayments.size())
                    .amount(sumPayments(statusPayments))
                    .build());
        }

        long successCount = filteredPayments.stream()
                .filter(payment -> payment.getStatus() == PaymentStatus.SUCCESS)
                .count();
        String successRate = totalPayments > 0
                ? BigDecimal.valueOf(successCount)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(totalPayments), 2, RoundingMode.HALF_UP)
                        .toPlainString() + "%"
                : "0%";
        BigDecimal averageAmount = totalPayments > 0
                ? totalAmount.divide(BigDecimal.valueOf(totalPayments), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        List<PaymentStatsResponse.WorkshopPaymentSummary> topWorkshops = buildTopWorkshops(filteredPayments);

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

    private List<PaymentStatsResponse.WorkshopPaymentSummary> buildTopWorkshops(List<Payment> payments) {
        return payments.stream()
                .filter(payment -> payment.getRegistration() != null && payment.getRegistration().getWorkshop() != null)
                .collect(Collectors.groupingBy(payment -> payment.getRegistration().getWorkshop()))
                .entrySet()
                .stream()
                .map(entry -> {
                    Workshop workshop = entry.getKey();
                    List<Payment> workshopPayments = entry.getValue();
                    long successCount = workshopPayments.stream()
                            .filter(payment -> payment.getStatus() == PaymentStatus.SUCCESS)
                            .count();
                    BigDecimal revenue = sumPayments(workshopPayments.stream()
                            .filter(payment -> payment.getStatus() == PaymentStatus.SUCCESS)
                            .toList());
                    return PaymentStatsResponse.WorkshopPaymentSummary.builder()
                            .workshopId(workshop.getId().toString())
                            .title(workshop.getTitle())
                            .totalPayments(workshopPayments.size())
                            .successCount(successCount)
                            .revenue(revenue)
                            .build();
                })
                .sorted((a, b) -> b.getRevenue().compareTo(a.getRevenue()))
                .limit(5)
                .toList();
    }

    private boolean matchesPaymentFilters(
            Payment payment,
            PaymentStatus statusFilter,
            UUID workshopId,
            ZonedDateTime from,
            ZonedDateTime to
    ) {
        if (statusFilter != null && payment.getStatus() != statusFilter) {
            return false;
        }
        if (workshopId != null) {
            Registration registration = payment.getRegistration();
            Workshop workshop = registration != null ? registration.getWorkshop() : null;
            if (workshop == null || !workshop.getId().equals(workshopId)) {
                return false;
            }
        }
        ZonedDateTime createdAt = payment.getCreatedAt();
        if (from != null && (createdAt == null || createdAt.isBefore(from))) {
            return false;
        }
        return to == null || (createdAt != null && !createdAt.isAfter(to));
    }

    private BigDecimal sumPayments(List<Payment> payments) {
        return payments.stream()
                .map(Payment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}

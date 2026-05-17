package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.notification.service.NotificationService;
import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PaymentTimeoutScheduler {

    private final PaymentRepository paymentRepository;
    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;
    private final NotificationService notificationService;

    @Value("${app.payment.pending-timeout-minutes:15}")
    private long pendingTimeoutMinutes;

    @Scheduled(fixedDelayString = "${app.payment.pending-timeout-scan-ms:60000}")
    @Transactional
    public void expireStalePendingPayments() {
        ZonedDateTime cutoff = ZonedDateTime.now().minus(Duration.ofMinutes(pendingTimeoutMinutes));
        List<Payment> stalePayments = paymentRepository.findByStatusAndCreatedAtBefore(PaymentStatus.PENDING, cutoff);

        for (Payment payment : stalePayments) {
            Registration registration = payment.getRegistration();
            if (registration.getStatus() != RegistrationStatus.PENDING) {
                continue;
            }

            payment.setStatus(PaymentStatus.FAILED);
            payment.setGatewayResponse("{\"status\":\"EXPIRED\",\"reason\":\"PENDING_PAYMENT_TIMEOUT\"}");
            paymentRepository.save(payment);

            registration.setStatus(RegistrationStatus.CANCELLED);
            registration.setCancelledAt(ZonedDateTime.now());
            registrationRepository.save(registration);

            Workshop workshop = workshopRepository.findByIdForUpdate(registration.getWorkshop().getId())
                    .orElse(registration.getWorkshop());
                    
            notificationService.createNotification(
                    registration.getUser().getId(),
                    Notification.NotificationType.PAYMENT_FAILED,
                    "Thanh toán hết hạn",
                    "Đăng ký workshop " + workshop.getTitle() + " đã bị hủy do hết hạn thanh toán.",
                    Map.of(
                            "registrationId", registration.getId().toString(),
                            "workshopId", workshop.getId().toString()
                    )
            );

            Registration promoted = promoteNextWaitlisted(workshop);
            if (promoted == null) {
                workshop.setRemainingSeats(Math.min(workshop.getCapacity(), workshop.getRemainingSeats() + 1));
                workshopRepository.save(workshop);
            } else {
                boolean needsPayment = workshop.getPrice() != null && workshop.getPrice().compareTo(BigDecimal.ZERO) > 0;
                notificationService.createNotification(
                        promoted.getUser().getId(),
                        needsPayment ? Notification.NotificationType.PAYMENT_PENDING : Notification.NotificationType.REGISTRATION_CONFIRMED,
                        needsPayment ? "Có chỗ trống - Vui lòng thanh toán" : "Đã có chỗ trong workshop",
                        needsPayment
                            ? "Bạn đã được chuyển từ danh sách chờ sang chờ thanh toán cho workshop " + workshop.getTitle() + ". Vui lòng thanh toán để xác nhận."
                            : "Bạn đã được chuyển từ danh sách chờ sang đã xác nhận cho workshop " + workshop.getTitle() + ".",
                        Map.of(
                                "registrationId", promoted.getId().toString(),
                                "workshopId", workshop.getId().toString()
                        )
                );
            }
        }
    }

    private Registration promoteNextWaitlisted(Workshop workshop) {
        boolean needsPayment = workshop.getPrice() != null && workshop.getPrice().compareTo(BigDecimal.ZERO) > 0;
        return registrationRepository
                .findFirstByWorkshopAndStatusOrderByRegisteredAtAsc(workshop, RegistrationStatus.WAITLISTED)
                .map(waitlisted -> {
                    waitlisted.setCancelledAt(null);
                    if (needsPayment) {
                        waitlisted.setStatus(RegistrationStatus.PENDING);
                        waitlisted = registrationRepository.save(waitlisted);
                        String paymentCode = "UH" + (100000 + new Random().nextInt(900000));
                        Payment payment = Payment.builder()
                                .registration(waitlisted)
                                .amount(workshop.getPrice())
                                .idempotencyKey(UUID.randomUUID().toString())
                                .status(PaymentStatus.PENDING)
                                .gatewayRef(paymentCode)
                                .build();
                        paymentRepository.save(payment);
                    } else {
                        waitlisted.setStatus(RegistrationStatus.CONFIRMED);
                        waitlisted.setQrCode(generateUniqueQrCode());
                        waitlisted.setConfirmedAt(ZonedDateTime.now());
                        waitlisted = registrationRepository.save(waitlisted);
                    }
                    return waitlisted;
                })
                .orElse(null);
    }

    private String generateUniqueQrCode() {
        String qrCode;
        do {
            qrCode = UUID.randomUUID().toString();
        } while (registrationRepository.existsByQrCode(qrCode));
        return qrCode;
    }
}

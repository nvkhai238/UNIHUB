package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.common.exception.AppException;

import com.unihub.workshop.module.notification.service.NotificationService;
import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.ZonedDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.Random;
import org.springframework.beans.factory.annotation.Value;

@Service
@RequiredArgsConstructor
public class PaymentProcessorService {

    private static final Logger log = LoggerFactory.getLogger(PaymentProcessorService.class);

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;
    private final NotificationService notificationService;

    @Value("${app.payment.demo-mode:false}")
    private boolean demoMode;

    @Value("${app.payment.demo-latency-ms:2000}")
    private long demoLatencyMs;

    private final Random random = new Random();

    @Async("notificationTaskExecutor")
    @Transactional
    public void processPendingPayment(UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElse(null);
        if (payment == null) {
            log.warn("Skip payment processing because payment {} is missing", paymentId);
            return;
        }

        if (demoMode) {
            log.info("[DEMO] Simulating payment processing latency: {}ms", demoLatencyMs);
            try {
                Thread.sleep(demoLatencyMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        Registration registration = payment.getRegistration();
        if (registration.getStatus() != RegistrationStatus.PENDING || payment.getStatus() != PaymentStatus.PENDING) {
            return;
        }

        try {
            Payment processedPayment = paymentService.processPayment(payment);
            if (processedPayment.getStatus() == PaymentStatus.SUCCESS) {
                confirmRegistration(registration);
            } else if (processedPayment.getStatus() == PaymentStatus.FAILED) {
                cancelRegistrationAndReleaseSeat(registration);
            }
        } catch (AppException e) {
            payment.setStatus(PaymentStatus.PENDING);
            payment.setGatewayResponse("{\"status\":\"PENDING_RETRY\",\"reason\":\"" + e.getErrorCode().getCode() + "\"}");
            paymentRepository.save(payment);
            log.warn("Payment {} remains pending after gateway fallback: {}", paymentId, e.getMessage());
        } catch (Exception e) {
            payment.setStatus(PaymentStatus.PENDING);
            payment.setGatewayResponse("{\"status\":\"PENDING_RETRY\",\"reason\":\"TIMEOUT\"}");
            paymentRepository.save(payment);
            log.warn("Payment {} remains pending after gateway timeout/error", paymentId, e);
        }
    }

    @Transactional
    public void processSepayWebhook(String paymentCode, java.math.BigDecimal transferAmount) {
        Payment payment = paymentRepository.findByGatewayRef(paymentCode).orElse(null);
        if (payment == null) {
            log.warn("Webhook received for unknown payment code: {}", paymentCode);
            return;
        }

        Registration registration = payment.getRegistration();
        if (payment.getStatus() == PaymentStatus.SUCCESS || registration.getStatus() == RegistrationStatus.CONFIRMED) {
            log.info("Payment {} is already confirmed", paymentCode);
            return;
        }

        if (demoMode) {
            log.info("[DEMO] Webhook received. Processing with demo latency...");
            try {
                Thread.sleep(demoLatencyMs / 2); // webhook is usually faster but still adds dramatic effect
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        if (transferAmount.compareTo(payment.getAmount()) >= 0) {
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setGatewayResponse("{\"status\":\"SEPAY_SUCCESS\"}");
            paymentRepository.save(payment);
            confirmRegistration(registration);
            log.info("Successfully processed sepay payment {}", paymentCode);
        } else {
            log.warn("Transfer amount {} is less than required amount {} for payment {}", transferAmount, payment.getAmount(), paymentCode);
        }
    }

    private void confirmRegistration(Registration registration) {
        if (registration.getQrCode() == null) {
            registration.setQrCode(generateUniqueQrCode());
        }
        registration.setStatus(RegistrationStatus.CONFIRMED);
        registration.setConfirmedAt(ZonedDateTime.now());
        Registration savedRegistration = registrationRepository.save(registration);
        scheduleNotification(
                savedRegistration.getUser().getId(),
                Notification.NotificationType.PAYMENT_SUCCESS,
                "Thanh toán thành công",
                "Thanh toán cho workshop " + savedRegistration.getWorkshop().getTitle() + " đã thành công.",
                Map.of(
                        "registrationId", savedRegistration.getId().toString(),
                        "workshopId", savedRegistration.getWorkshop().getId().toString()
                )
        );
    }

    private void cancelRegistrationAndReleaseSeat(Registration registration) {
        registration.setStatus(RegistrationStatus.CANCELLED);
        registration.setCancelledAt(ZonedDateTime.now());
        registrationRepository.save(registration);
        scheduleNotification(
                registration.getUser().getId(),
                Notification.NotificationType.PAYMENT_FAILED,
                "Thanh toán thất bại",
                "Thanh toán cho workshop " + registration.getWorkshop().getTitle() + " không thành công. Đăng ký đã được hủy.",
                Map.of(
                        "registrationId", registration.getId().toString(),
                        "workshopId", registration.getWorkshop().getId().toString()
                )
        );

        Workshop workshop = workshopRepository.findByIdForUpdate(registration.getWorkshop().getId())
                .orElse(registration.getWorkshop());
        Registration promoted = promoteNextWaitlisted(workshop);
        if (promoted == null) {
            workshop.setRemainingSeats(Math.min(workshop.getCapacity(), workshop.getRemainingSeats() + 1));
            workshopRepository.save(workshop);
        }
    }

    private void scheduleNotification(UUID userId, Notification.NotificationType type, String title, String body, Map<String, Object> data) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    notificationService.createNotification(userId, type, title, body, data);
                }
            });
        } else {
            notificationService.createNotification(userId, type, title, body, data);
        }
    }

    private Registration promoteNextWaitlisted(Workshop workshop) {
        return registrationRepository
                .findFirstByWorkshopAndStatusOrderByRegisteredAtAsc(workshop, RegistrationStatus.WAITLISTED)
                .map(waitlisted -> {
                    waitlisted.setStatus(RegistrationStatus.CONFIRMED);
                    waitlisted.setQrCode(generateUniqueQrCode());
                    waitlisted.setConfirmedAt(ZonedDateTime.now());
                    waitlisted.setCancelledAt(null);
                    return registrationRepository.save(waitlisted);
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

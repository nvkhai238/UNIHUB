package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.module.notification.service.EmailService;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentProcessorService {

    private static final Logger log = LoggerFactory.getLogger(PaymentProcessorService.class);

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;
    private final EmailService emailService;

    @Async("notificationTaskExecutor")
    @Transactional
    public void processPendingPayment(UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElse(null);
        if (payment == null) {
            log.warn("Skip payment processing because payment {} is missing", paymentId);
            return;
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

    private void confirmRegistration(Registration registration) {
        if (registration.getQrCode() == null) {
            registration.setQrCode(generateUniqueQrCode());
        }
        registration.setStatus(RegistrationStatus.CONFIRMED);
        registration.setConfirmedAt(ZonedDateTime.now());
        Registration savedRegistration = registrationRepository.save(registration);
        scheduleConfirmationEmail(savedRegistration.getId());
    }

    private void cancelRegistrationAndReleaseSeat(Registration registration) {
        registration.setStatus(RegistrationStatus.CANCELLED);
        registration.setCancelledAt(ZonedDateTime.now());
        registrationRepository.save(registration);

        Workshop workshop = workshopRepository.findByIdForUpdate(registration.getWorkshop().getId())
                .orElse(registration.getWorkshop());
        workshop.setRemainingSeats(workshop.getRemainingSeats() + 1);
        workshopRepository.save(workshop);
    }

    private String generateUniqueQrCode() {
        String qrCode;
        do {
            qrCode = UUID.randomUUID().toString();
        } while (registrationRepository.existsByQrCode(qrCode));
        return qrCode;
    }

    private void scheduleConfirmationEmail(UUID registrationId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    emailService.sendRegistrationConfirmation(registrationId);
                }
            });
        } else {
            emailService.sendRegistrationConfirmation(registrationId);
        }
    }
}

package com.unihub.workshop.module.registration.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.service.PaymentProcessorService;
import com.unihub.workshop.module.notification.service.EmailService;
import com.unihub.workshop.module.registration.dto.RegistrationQrResponse;
import com.unihub.workshop.module.registration.dto.RegistrationRequest;
import com.unihub.workshop.module.registration.dto.RegistrationResponse;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentProcessorService paymentProcessorService;
    private final EmailService emailService;
    private final QrCodeService qrCodeService;

    @Transactional
    public RegistrationResponse register(RegistrationRequest request, String idempotencyKey) {
        User user = getCurrentUser();
        Workshop workshop = workshopRepository.findByIdForUpdate(request.getWorkshopId())
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));

        if (workshop.getStatus() != WorkshopStatus.PUBLISHED) {
            throw new AppException(ErrorCode.FORBIDDEN, "Workshop is not published");
        }

        boolean alreadyRegistered = registrationRepository.existsByUserAndWorkshop(user, workshop);
        if (alreadyRegistered) {
            throw new AppException(ErrorCode.DUPLICATE_REGISTRATION);
        }

        Registration registration = Registration.builder()
                .user(user)
                .workshop(workshop)
                .build();

        if (workshop.getRemainingSeats() <= 0) {
            registration.setStatus(RegistrationStatus.WAITLISTED);
            return RegistrationResponse.from(registrationRepository.save(registration));
        }

        workshop.setRemainingSeats(workshop.getRemainingSeats() - 1);
        workshopRepository.save(workshop);

        if (workshop.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            registration.setStatus(RegistrationStatus.PENDING);
            registration = registrationRepository.save(registration);
            
            Payment payment = Payment.builder()
                    .registration(registration)
                    .amount(workshop.getPrice())
                    .idempotencyKey(idempotencyKey)
                    .status(PaymentStatus.PENDING)
                    .gatewayRef(UUID.randomUUID().toString())
                    .build();
            payment = paymentRepository.save(payment);
            schedulePaymentProcessing(payment.getId());
        } else {
            registration.setStatus(RegistrationStatus.CONFIRMED);
            registration.setQrCode(generateUniqueQrCode());
            registration.setConfirmedAt(ZonedDateTime.now());
        }

        Registration savedRegistration = registrationRepository.save(registration);
        scheduleRegistrationConfirmationEmail(savedRegistration);
        return RegistrationResponse.from(savedRegistration);
    }

    @Transactional(readOnly = true)
    public List<RegistrationResponse> getMyRegistrations() {
        User user = getCurrentUser();
        return registrationRepository.findByUser(user).stream()
                .map(RegistrationResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RegistrationResponse getMyRegistration(UUID id) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.REGISTRATION_NOT_FOUND));
        User user = getCurrentUser();
        if (!registration.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your registration");
        }
        return RegistrationResponse.from(registration);
    }

    @Transactional
    public RegistrationResponse retryPayment(UUID id) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.REGISTRATION_NOT_FOUND));
        
        if (registration.getStatus() != RegistrationStatus.CANCELLED && registration.getStatus() != RegistrationStatus.PENDING) {
             throw new AppException(ErrorCode.FORBIDDEN, "Can only retry pending or cancelled registrations");
        }

        User user = getCurrentUser();
        if (!registration.getUser().getId().equals(user.getId())) {
             throw new AppException(ErrorCode.FORBIDDEN, "Not your registration");
        }

        Workshop workshop = workshopRepository.findByIdForUpdate(registration.getWorkshop().getId())
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));

        if (registration.getStatus() == RegistrationStatus.CANCELLED) {
             if (workshop.getRemainingSeats() <= 0) {
                 throw new AppException(ErrorCode.WORKSHOP_FULL);
             }
             workshop.setRemainingSeats(workshop.getRemainingSeats() - 1);
             workshopRepository.save(workshop);
        }

        Payment payment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Payment not found"));

        payment.setStatus(PaymentStatus.PENDING);
        payment.setGatewayRef(UUID.randomUUID().toString());
        paymentRepository.save(payment);

        if (registration.getStatus() == RegistrationStatus.CANCELLED) {
            registration.setStatus(RegistrationStatus.PENDING);
            registration.setCancelledAt(null);
            registrationRepository.save(registration);
        }

        schedulePaymentProcessing(payment.getId());
        return RegistrationResponse.from(registration);
    }

    @Transactional(readOnly = true)
    public RegistrationQrResponse getMyQrCode(UUID id) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.REGISTRATION_NOT_FOUND));

        User user = getCurrentUser();
        if (!registration.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your registration");
        }

        if (registration.getStatus() != RegistrationStatus.CONFIRMED || registration.getQrCode() == null) {
            throw new AppException(ErrorCode.QR_CODE_UNAVAILABLE, "QR code is only available for confirmed registrations");
        }

        return RegistrationQrResponse.from(registration, qrCodeService.generateDataUri(registration.getQrCode()));
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private String generateUniqueQrCode() {
        String qrCode;
        do {
            qrCode = UUID.randomUUID().toString();
        } while (registrationRepository.existsByQrCode(qrCode));
        return qrCode;
    }

    private void scheduleRegistrationConfirmationEmail(Registration registration) {
        if (registration.getStatus() != RegistrationStatus.CONFIRMED || registration.getQrCode() == null) {
            return;
        }

        UUID registrationId = registration.getId();
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

    private void schedulePaymentProcessing(UUID paymentId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    paymentProcessorService.processPendingPayment(paymentId);
                }
            });
        } else {
            paymentProcessorService.processPendingPayment(paymentId);
        }
    }
}

package com.unihub.workshop.module.registration.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.service.PaymentProcessorService;
import com.unihub.workshop.module.notification.service.EmailService;
import com.unihub.workshop.module.notification.service.NotificationService;
import com.unihub.workshop.module.notification.entity.Notification;
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
import java.util.Map;
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
    private final NotificationService notificationService;
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
            Registration savedWaitlisted = registrationRepository.save(registration);
            scheduleWaitlistCreatedNotification(savedWaitlisted);
            return RegistrationResponse.from(savedWaitlisted);
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
        scheduleRegistrationCreatedNotification(savedRegistration);
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

    @Transactional
    public RegistrationResponse cancelMyRegistration(UUID id) {
        Registration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.REGISTRATION_NOT_FOUND));
        User user = getCurrentUser();
        if (!registration.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your registration");
        }
        if (registration.getStatus() == RegistrationStatus.CANCELLED) {
            throw new AppException(ErrorCode.REGISTRATION_ALREADY_CANCELLED, "Registration is already cancelled");
        }

        Workshop workshop = workshopRepository.findByIdForUpdate(registration.getWorkshop().getId())
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));
        if (!workshop.getStartTime().isAfter(ZonedDateTime.now())) {
            throw new AppException(ErrorCode.WORKSHOP_IN_PROGRESS, "Cannot cancel a registration after the workshop has started");
        }

        RegistrationStatus previousStatus = registration.getStatus();
        registration.setStatus(RegistrationStatus.CANCELLED);
        registration.setCancelledAt(ZonedDateTime.now());
        Registration cancelled = registrationRepository.save(registration);
        settlePaymentOnCancellation(cancelled);

        Registration promoted = null;
        if (previousStatus == RegistrationStatus.CONFIRMED || previousStatus == RegistrationStatus.PENDING) {
            promoted = promoteNextWaitlisted(workshop);
            if (promoted == null) {
                workshop.setRemainingSeats(Math.min(workshop.getCapacity(), workshop.getRemainingSeats() + 1));
                workshopRepository.save(workshop);
            }
        }

        scheduleRegistrationCancelledNotification(cancelled);
        if (promoted != null) {
            scheduleRegistrationConfirmationEmail(promoted);
            scheduleWaitlistPromotedNotification(promoted);
        }

        return RegistrationResponse.from(cancelled);
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

    private void settlePaymentOnCancellation(Registration registration) {
        paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                .ifPresent(payment -> {
                    if (payment.getStatus() == PaymentStatus.SUCCESS) {
                        payment.setStatus(PaymentStatus.REFUNDED);
                    } else if (payment.getStatus() == PaymentStatus.PENDING) {
                        payment.setStatus(PaymentStatus.FAILED);
                    }
                    paymentRepository.save(payment);
                });
    }

    private void scheduleRegistrationCancelledNotification(Registration registration) {
        UUID userId = registration.getUser().getId();
        String workshopTitle = registration.getWorkshop().getTitle();
        UUID workshopId = registration.getWorkshop().getId();
        UUID registrationId = registration.getId();
        Runnable task = () -> notificationService.createNotification(
                userId,
                Notification.NotificationType.REGISTRATION_CANCELLED,
                "Dang ky da huy",
                "Dang ky workshop " + workshopTitle + " da duoc huy.",
                Map.of("registrationId", registrationId.toString(), "workshopId", workshopId.toString())
        );
        runAfterCommit(task);
    }

    private void scheduleRegistrationCreatedNotification(Registration registration) {
        Notification.NotificationType type = registration.getStatus() == RegistrationStatus.PENDING
                ? Notification.NotificationType.PAYMENT_PENDING
                : Notification.NotificationType.REGISTRATION_CONFIRMED;
        String title = registration.getStatus() == RegistrationStatus.PENDING
                ? "Dang ky dang cho thanh toan"
                : "Dang ky thanh cong";
        String body = registration.getStatus() == RegistrationStatus.PENDING
                ? "Dang ky workshop " + registration.getWorkshop().getTitle() + " dang cho xac nhan thanh toan."
                : "Ban da dang ky thanh cong workshop " + registration.getWorkshop().getTitle() + ".";
        UUID userId = registration.getUser().getId();
        UUID workshopId = registration.getWorkshop().getId();
        UUID registrationId = registration.getId();
        Runnable task = () -> notificationService.createNotification(
                userId,
                type,
                title,
                body,
                Map.of("registrationId", registrationId.toString(), "workshopId", workshopId.toString())
        );
        runAfterCommit(task);
    }

    private void scheduleWaitlistCreatedNotification(Registration registration) {
        UUID userId = registration.getUser().getId();
        UUID workshopId = registration.getWorkshop().getId();
        UUID registrationId = registration.getId();
        Runnable task = () -> notificationService.createNotification(
                userId,
                Notification.NotificationType.REGISTRATION_PENDING,
                "Da vao danh sach cho",
                "Workshop " + registration.getWorkshop().getTitle() + " hien da het cho. Ban da duoc them vao danh sach cho.",
                Map.of("registrationId", registrationId.toString(), "workshopId", workshopId.toString())
        );
        runAfterCommit(task);
    }

    private void scheduleWaitlistPromotedNotification(Registration registration) {
        UUID userId = registration.getUser().getId();
        String workshopTitle = registration.getWorkshop().getTitle();
        UUID workshopId = registration.getWorkshop().getId();
        UUID registrationId = registration.getId();
        Runnable task = () -> notificationService.createNotification(
                userId,
                Notification.NotificationType.REGISTRATION_CONFIRMED,
                "Da co cho trong workshop",
                "Ban da duoc chuyen tu danh sach cho sang da xac nhan cho workshop " + workshopTitle + ".",
                Map.of("registrationId", registrationId.toString(), "workshopId", workshopId.toString())
        );
        runAfterCommit(task);
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

    private void runAfterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
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

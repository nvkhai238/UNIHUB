package com.unihub.workshop.module.registration.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.service.PaymentProcessorService;
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
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentProcessorService paymentProcessorService;
    private final NotificationService notificationService;
    private final QrCodeService qrCodeService;
    private final ObjectMapper objectMapper;

    @Transactional
    public RegistrationResponse register(RegistrationRequest request, String idempotencyKey) {
        User user = getCurrentUser();
        Workshop workshop = workshopRepository.findByIdForUpdate(request.getWorkshopId())
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));

        if (workshop.getStatus() != WorkshopStatus.PUBLISHED) {
            throw new AppException(ErrorCode.FORBIDDEN, "Workshop is not published");
        }

        // Guard thời gian: không cho đăng ký workshop đã kết thúc
        ZonedDateTime now = ZonedDateTime.now();
        if (!now.isBefore(workshop.getEndTime())) {
            throw new AppException(ErrorCode.WORKSHOP_ENDED,
                    "Workshop đã kết thúc, không thể đăng ký");
        }

        // Guard thời gian: không cho đăng ký workshop đang diễn ra
        if (!now.isBefore(workshop.getStartTime())) {
            throw new AppException(ErrorCode.WORKSHOP_STARTED,
                    "Workshop đang diễn ra, không còn nhận đăng ký mới");
        }

        // Check if user already has an active (non-cancelled) registration
        boolean alreadyRegistered = registrationRepository.existsByUserAndWorkshopAndStatusNot(user, workshop, RegistrationStatus.CANCELLED);
        if (alreadyRegistered) {
            throw new AppException(ErrorCode.DUPLICATE_REGISTRATION);
        }

        // Try to find and reuse a CANCELLED registration (DB has unique constraint on user_id + workshop_id)
        Optional<Registration> existingCancelled = registrationRepository.findByUserAndWorkshop(user, workshop);
        Registration registration;
        if (existingCancelled.isPresent() && existingCancelled.get().getStatus() == RegistrationStatus.CANCELLED) {
            registration = existingCancelled.get();
            registration.setCancelledAt(null);
            registration.setQrCode(null);
            registration.setConfirmedAt(null);
        } else {
            registration = Registration.builder()
                    .user(user)
                    .workshop(workshop)
                    .build();
        }

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
            
            String paymentCode = "UH" + (100000 + new java.util.Random().nextInt(900000));
            Payment payment = Payment.builder()
                    .registration(registration)
                    .amount(workshop.getPrice())
                    .idempotencyKey(UUID.randomUUID().toString())
                    .status(PaymentStatus.PENDING)
                    .gatewayRef(paymentCode)
                    .build();
            payment = paymentRepository.save(payment);
            // Không tự động xử lý thanh toán ở đây. Sinh viên phải tự bấm "Thanh toán" ở trang My Registrations.
            // schedulePaymentProcessing(payment.getId());
        } else {
            registration.setStatus(RegistrationStatus.CONFIRMED);
            registration.setQrCode(generateUniqueQrCode());
            registration.setConfirmedAt(ZonedDateTime.now());
        }

        Registration savedRegistration = registrationRepository.save(registration);
        scheduleRegistrationCreatedNotification(savedRegistration);
        scheduleNewRegistrationOrganizerNotification(savedRegistration);
        return RegistrationResponse.from(savedRegistration);
    }

    @Transactional(readOnly = true)
    public Page<RegistrationResponse> getMyRegistrations(Pageable pageable) {
        User user = getCurrentUser();
        return registrationRepository.findByUserOrderByRegisteredAtDesc(user, pageable)
                .map(RegistrationResponse::from);
    }

    @Transactional(readOnly = true)
    public RegistrationResponse getMyRegistrationForWorkshop(UUID workshopId) {
        User user = getCurrentUser();
        Workshop workshop = workshopRepository.findById(workshopId)
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));

        return registrationRepository
                .findTopByUserAndWorkshopAndStatusNotOrderByRegisteredAtDesc(user, workshop, RegistrationStatus.CANCELLED)
                .map(RegistrationResponse::from)
                .orElse(null);
    }
    
    @Transactional(readOnly = true)
    public Page<RegistrationResponse> getRegistrationsByWorkshop(UUID workshopId, RegistrationStatus status, Pageable pageable) {
        Workshop workshop = workshopRepository.findById(workshopId)
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));
        
        if (status != null) {
            return registrationRepository.findByWorkshopAndStatusOrderByRegisteredAtDesc(workshop, status, pageable)
                    .map(RegistrationResponse::from);
        }
        return registrationRepository.findByWorkshopOrderByRegisteredAtDesc(workshop, pageable)
                .map(RegistrationResponse::from);
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
        payment.setGatewayRef("UH" + (100000 + new java.util.Random().nextInt(900000)));
        payment.setGatewayResponse(null); // Clear old gateway response
        paymentRepository.save(payment);

        if (registration.getStatus() == RegistrationStatus.CANCELLED) {
            registration.setStatus(RegistrationStatus.PENDING);
            registration.setCancelledAt(null);
            registrationRepository.save(registration);
        }

        // Don't auto-process payment - wait for SePay webhook confirmation
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
        if (registration.getWorkshop().getPrice() != null
                && registration.getWorkshop().getPrice().compareTo(BigDecimal.ZERO) > 0) {
            if (registration.getStatus() != RegistrationStatus.PENDING) {
                throw new AppException(
                        ErrorCode.FORBIDDEN,
                        "Workshop đã thanh toán thành công nên không hỗ trợ sinh viên tự hủy."
                );
            }
        }

        if (registration.getWorkshop().getStartTime() != null &&
                ZonedDateTime.now().plusHours(6).isAfter(registration.getWorkshop().getStartTime())) {
            throw new AppException(
                    ErrorCode.REGISTRATION_CANCEL_TIMEOUT,
                    "Không thể hủy đăng ký khi workshop sắp diễn ra trong dưới 6 tiếng."
            );
        }

        Workshop workshop = workshopRepository.findByIdForUpdate(registration.getWorkshop().getId())
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));

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

        String qrPayload;
        try {
            qrPayload = String.format("--- VÉ ĐIỆN TỬ UNIHUB ---\nID: %s\nSinh viên: %s\nWorkshop: %s\nPhòng: %s\nThời gian: %s",
                    registration.getQrCode(),
                    user.getFullName(),
                    registration.getWorkshop().getTitle(),
                    registration.getWorkshop().getRoom(),
                    registration.getWorkshop().getStartTime().toString()
            );
        } catch (Exception e) {
            qrPayload = registration.getQrCode(); // fallback
        }

        return RegistrationQrResponse.from(registration, qrCodeService.generateDataUri(qrPayload));
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
        boolean needsPayment = registration.getStatus() == RegistrationStatus.PENDING;
        Notification.NotificationType type = needsPayment
                ? Notification.NotificationType.PAYMENT_PENDING
                : Notification.NotificationType.REGISTRATION_CONFIRMED;
        String title = needsPayment ? "Có chỗ trống - Vui lòng thanh toán" : "Đã có chỗ trong workshop";
        String body = needsPayment
                ? "Bạn đã được chuyển từ danh sách chờ sang chờ thanh toán cho workshop " + workshopTitle + ". Vui lòng thanh toán để xác nhận."
                : "Bạn đã được chuyển từ danh sách chờ sang đã xác nhận cho workshop " + workshopTitle + ".";
        Runnable task = () -> notificationService.createNotification(
                userId,
                type,
                title,
                body,
                Map.of("registrationId", registrationId.toString(), "workshopId", workshopId.toString())
        );
        runAfterCommit(task);
    }

    private void scheduleNewRegistrationOrganizerNotification(Registration registration) {
        User organizer = registration.getWorkshop().getCreatedBy();
        if (organizer == null) return;

        String studentName = registration.getUser().getFullName();
        String workshopTitle = registration.getWorkshop().getTitle();
        
        Runnable task = () -> notificationService.createNotification(
                organizer.getId(),
                Notification.NotificationType.NEW_REGISTRATION,
                "Có đăng ký mới!",
                "Sinh viên " + studentName + " vừa đăng ký workshop: " + workshopTitle,
                Map.of("registrationId", registration.getId().toString(), "workshopId", registration.getWorkshop().getId().toString())
        );
        runAfterCommit(task);
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

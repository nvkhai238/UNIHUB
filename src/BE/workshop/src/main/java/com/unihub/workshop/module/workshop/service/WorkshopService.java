package com.unihub.workshop.module.workshop.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.dto.ChangeStatusRequest;
import com.unihub.workshop.module.workshop.dto.WorkshopRequest;
import com.unihub.workshop.module.workshop.dto.WorkshopResponse;
import com.unihub.workshop.module.workshop.dto.WorkshopStatisticsResponse;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.notification.service.NotificationService;
import com.unihub.workshop.module.notification.service.EmailService;
import com.unihub.workshop.module.checkin.repository.CheckinRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkshopService {

    private final WorkshopRepository workshopRepository;
    private final UserRepository userRepository;
    private final RegistrationRepository registrationRepository;
    private final PaymentRepository paymentRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final CheckinRepository checkinRepository;

    private static final Map<WorkshopStatus, Set<WorkshopStatus>> TRANSITIONS = Map.of(
            WorkshopStatus.DRAFT, EnumSet.of(WorkshopStatus.PUBLISHED, WorkshopStatus.CANCELLED),
            WorkshopStatus.PUBLISHED, EnumSet.of(WorkshopStatus.CANCELLED),
            WorkshopStatus.CANCELLED, EnumSet.noneOf(WorkshopStatus.class)
    );

    @Transactional
    public WorkshopResponse create(WorkshopRequest request) {
        User creator = getCurrentUser();
        validateWorkshopSchedule(request);

        Workshop workshop = Workshop.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .speakerName(request.getSpeakerName())
                .speakerBio(request.getSpeakerBio())
                .room(request.getRoom())
                .roomLayoutUrl(request.getRoomLayoutUrl())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .capacity(request.getCapacity())
                .remainingSeats(request.getCapacity())
                .price(request.getPrice())
                .pdfUrl(request.getPdfUrl())
                .status(WorkshopStatus.DRAFT)
                .aiSummaryStatus("NONE")
                .createdBy(creator)
                .build();

        return WorkshopResponse.from(workshopRepository.save(workshop));
    }

    @Transactional
    public WorkshopResponse update(UUID id, WorkshopRequest request) {
        Workshop workshop = findEntityById(id);
        validateWorkshopSchedule(request);

        if (workshop.getStatus() == WorkshopStatus.CANCELLED) {
            throw new AppException(ErrorCode.FORBIDDEN, "Cannot update a cancelled workshop");
        }

        String originalTitle = workshop.getTitle();
        String originalRoom = workshop.getRoom();
        ZonedDateTime originalStartTime = workshop.getStartTime();
        ZonedDateTime originalEndTime = workshop.getEndTime();

        List<String> changeMessages = new ArrayList<>();
        if (!Objects.equals(originalTitle, request.getTitle())) {
            changeMessages.add("Tieu de workshop da duoc cap nhat");
        }
        if (!Objects.equals(originalRoom, request.getRoom())) {
            changeMessages.add("Phong hoc da doi tu " + safeValue(originalRoom) + " sang " + safeValue(request.getRoom()));
        }
        if (!Objects.equals(originalStartTime, request.getStartTime())) {
            changeMessages.add("Gio bat dau da doi tu " + formatDateTime(originalStartTime) + " sang " + formatDateTime(request.getStartTime()));
        }
        if (!Objects.equals(originalEndTime, request.getEndTime())) {
            changeMessages.add("Gio ket thuc da doi tu " + formatDateTime(originalEndTime) + " sang " + formatDateTime(request.getEndTime()));
        }

        workshop.setTitle(request.getTitle());
        workshop.setDescription(request.getDescription());
        workshop.setSpeakerName(request.getSpeakerName());
        workshop.setSpeakerBio(request.getSpeakerBio());
        workshop.setRoom(request.getRoom());
        workshop.setRoomLayoutUrl(request.getRoomLayoutUrl());
        workshop.setStartTime(request.getStartTime());
        workshop.setEndTime(request.getEndTime());
        workshop.setPdfUrl(request.getPdfUrl());
        workshop.setPrice(request.getPrice());

        if (!request.getCapacity().equals(workshop.getCapacity())) {
            int diff = request.getCapacity() - workshop.getCapacity();
            workshop.setCapacity(request.getCapacity());
            workshop.setRemainingSeats(Math.max(0, workshop.getRemainingSeats() + diff));
        }

        Workshop saved = workshopRepository.save(workshop);
        promoteWaitlistIfSeatsAvailable(saved);
        scheduleWorkshopUpdateNotifications(saved, changeMessages);
        return WorkshopResponse.from(saved);
    }

    @Transactional
    public WorkshopResponse changeStatus(UUID id, ChangeStatusRequest request) {
        Workshop workshop = findEntityById(id);
        WorkshopStatus target = request.getStatus();

        Set<WorkshopStatus> allowed = TRANSITIONS.getOrDefault(workshop.getStatus(), EnumSet.noneOf(WorkshopStatus.class));
        if (!allowed.contains(target)) {
            throw new AppException(ErrorCode.FORBIDDEN,
                    "Cannot transition from " + workshop.getStatus() + " to " + target);
        }

        workshop.setStatus(target);
        return WorkshopResponse.from(workshopRepository.save(workshop));
    }

    @Transactional(readOnly = true)
    public WorkshopResponse findById(UUID id) {
        return WorkshopResponse.from(findEntityById(id));
    }

    @Transactional(readOnly = true)
    public Page<WorkshopResponse> findPublished(Pageable pageable) {
        return workshopRepository
                .findByStatus(WorkshopStatus.PUBLISHED, pageable)
                .map(WorkshopResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<WorkshopResponse> findAll(WorkshopStatus status, Pageable pageable) {
        if (status != null) {
            return workshopRepository.findByStatus(status, pageable).map(WorkshopResponse::from);
        }
        return workshopRepository.findAll(pageable).map(WorkshopResponse::from);
    }

    @Transactional
    public void cancel(UUID id) {
        Workshop workshop = findEntityById(id);

        if (workshop.getStatus() == WorkshopStatus.CANCELLED) {
            throw new AppException(ErrorCode.FORBIDDEN, "Workshop is already cancelled");
        }

        ZonedDateTime now = ZonedDateTime.now();

        // Không cho hủy nếu workshop đang diễn ra (đã qua startTime nhưng chưa qua endTime)
        if (!now.isBefore(workshop.getStartTime()) && now.isBefore(workshop.getEndTime())) {
            throw new AppException(ErrorCode.WORKSHOP_IN_PROGRESS,
                    "Không thể hủy workshop đang diễn ra");
        }

        // Không cho hủy nếu sắp diễn ra trong vòng 30 phút
        if (now.isBefore(workshop.getStartTime()) &&
                !now.isBefore(workshop.getStartTime().minusMinutes(30))) {
            throw new AppException(ErrorCode.WORKSHOP_IN_PROGRESS,
                    "Không thể hủy workshop trong vòng 30 phút trước khi bắt đầu");
        }

        // Không cho hủy nếu đã có người check in
        long checkinCount = checkinRepository.countByRegistration_Workshop(workshop);
        if (checkinCount > 0) {
            throw new AppException(ErrorCode.WORKSHOP_IN_PROGRESS,
                    "Không thể hủy workshop đã có " + checkinCount + " người check in");
        }

        workshop.setStatus(WorkshopStatus.CANCELLED);
        workshopRepository.save(workshop);

        List<Registration> registrations = registrationRepository.findByWorkshop(workshop);
        List<UUID> cancellationEmailRegistrationIds = new ArrayList<>();
        List<UUID> cancellationNotificationRegistrationIds = new ArrayList<>();
        for (Registration registration : registrations) {
            // Only refund if confirmed (or pending)
            if (registration.getStatus() == RegistrationStatus.CONFIRMED || registration.getStatus() == RegistrationStatus.PENDING) {
                registration.setStatus(RegistrationStatus.CANCELLED);
                registration.setCancelledAt(ZonedDateTime.now());
                registrationRepository.save(registration);
                cancellationEmailRegistrationIds.add(registration.getId());
                cancellationNotificationRegistrationIds.add(registration.getId());

                paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                        .ifPresent(payment -> {
                            if (payment.getStatus() == PaymentStatus.SUCCESS) {
                                payment.setStatus(PaymentStatus.REFUNDED);
                                paymentRepository.save(payment);
                            } else if (payment.getStatus() == PaymentStatus.PENDING) {
                                payment.setStatus(PaymentStatus.FAILED);
                                paymentRepository.save(payment);
                            }
                        });
            } else if (registration.getStatus() == RegistrationStatus.WAITLISTED) {
                registration.setStatus(RegistrationStatus.CANCELLED);
                registration.setCancelledAt(ZonedDateTime.now());
                registrationRepository.save(registration);
                cancellationEmailRegistrationIds.add(registration.getId());
                cancellationNotificationRegistrationIds.add(registration.getId());
            }
        }
        scheduleWorkshopCancellationEmails(cancellationEmailRegistrationIds);
        scheduleWorkshopCancellationNotifications(workshop, cancellationNotificationRegistrationIds);
    }

    @Transactional(readOnly = true)
    public WorkshopStatisticsResponse getStatistics() {
        return getStatistics(null, null, null, null);
    }

    @Transactional(readOnly = true)
    public WorkshopStatisticsResponse getStatistics(
            UUID workshopId,
            WorkshopStatus status,
            ZonedDateTime from,
            ZonedDateTime to
    ) {
        List<Workshop> filteredWorkshops = workshopRepository.findAll().stream()
                .filter(workshop -> workshopId == null || workshop.getId().equals(workshopId))
                .filter(workshop -> status == null || workshop.getStatus() == status)
                .filter(workshop -> from == null || !workshop.getStartTime().isBefore(from))
                .filter(workshop -> to == null || !workshop.getStartTime().isAfter(to))
                .sorted(Comparator.comparing(Workshop::getStartTime))
                .toList();

        long totalWorkshops = filteredWorkshops.size();
        List<Payment> payments = paymentRepository.findAll();

        List<WorkshopStatisticsResponse.WorkshopRegistrationStat> breakdown = filteredWorkshops.stream()
                .map(workshop -> {
                    List<Registration> registrations = registrationRepository.findByWorkshop(workshop);
                    long confirmed = countByStatus(registrations, RegistrationStatus.CONFIRMED);
                    long waitlisted = countByStatus(registrations, RegistrationStatus.WAITLISTED);
                    long pending = countByStatus(registrations, RegistrationStatus.PENDING);
                    long cancelled = countByStatus(registrations, RegistrationStatus.CANCELLED);
                    long checkins = checkinRepository.countByRegistration_Workshop(workshop);
                    double checkinRate = confirmed == 0 ? 0 : (double) checkins / confirmed;
                    BigDecimal revenue = sumSuccessfulPayments(payments, workshop);

                    return new WorkshopStatisticsResponse.WorkshopRegistrationStat(
                            workshop.getId(),
                            workshop.getTitle(),
                            registrations.size(),
                            confirmed,
                            waitlisted,
                            pending,
                            cancelled,
                            checkins,
                            checkinRate,
                            workshop.getCapacity(),
                            workshop.getRemainingSeats(),
                            revenue
                    );
                })
                .toList();

        long totalRegistrations = breakdown.stream()
                .mapToLong(WorkshopStatisticsResponse.WorkshopRegistrationStat::getRegistrationsCount)
                .sum();
        long totalCheckins = breakdown.stream()
                .mapToLong(WorkshopStatisticsResponse.WorkshopRegistrationStat::getCheckinCount)
                .sum();
        long successfulPayments = filteredWorkshops.stream()
                .mapToLong(workshop -> countSuccessfulPayments(payments, workshop))
                .sum();
        BigDecimal totalRevenue = breakdown.stream()
                .map(WorkshopStatisticsResponse.WorkshopRegistrationStat::getRevenue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new WorkshopStatisticsResponse(
                totalWorkshops,
                totalRegistrations,
                breakdown.stream().mapToLong(WorkshopStatisticsResponse.WorkshopRegistrationStat::getConfirmedCount).sum(),
                breakdown.stream().mapToLong(WorkshopStatisticsResponse.WorkshopRegistrationStat::getWaitlistedCount).sum(),
                breakdown.stream().mapToLong(WorkshopStatisticsResponse.WorkshopRegistrationStat::getPendingCount).sum(),
                breakdown.stream().mapToLong(WorkshopStatisticsResponse.WorkshopRegistrationStat::getCancelledCount).sum(),
                totalCheckins,
                successfulPayments,
                totalRevenue,
                breakdown
        );
    }

    private Workshop findEntityById(UUID id) {
        return workshopRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String email = auth.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private long countByStatus(List<Registration> registrations, RegistrationStatus status) {
        return registrations.stream()
                .filter(registration -> registration.getStatus() == status)
                .count();
    }

    private long countSuccessfulPayments(List<Payment> payments, Workshop workshop) {
        return payments.stream()
                .filter(payment -> payment.getStatus() == PaymentStatus.SUCCESS)
                .filter(payment -> belongsToWorkshop(payment, workshop))
                .count();
    }

    private BigDecimal sumSuccessfulPayments(List<Payment> payments, Workshop workshop) {
        return payments.stream()
                .filter(payment -> payment.getStatus() == PaymentStatus.SUCCESS)
                .filter(payment -> belongsToWorkshop(payment, workshop))
                .map(Payment::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private boolean belongsToWorkshop(Payment payment, Workshop workshop) {
        Registration registration = payment.getRegistration();
        Workshop paymentWorkshop = registration != null ? registration.getWorkshop() : null;
        return paymentWorkshop != null && paymentWorkshop.getId().equals(workshop.getId());
    }

    private void scheduleWorkshopCancellationEmails(List<UUID> registrationIds) {
        if (registrationIds.isEmpty()) {
            return;
        }

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    registrationIds.forEach(emailService::sendWorkshopCancellation);
                }
            });
        } else {
            registrationIds.forEach(emailService::sendWorkshopCancellation);
        }
    }

    private void scheduleWorkshopCancellationNotifications(Workshop workshop, List<UUID> registrationIds) {
        if (registrationIds.isEmpty()) {
            return;
        }

        Runnable action = () -> registrationIds.forEach(registrationId -> registrationRepository.findById(registrationId)
                .ifPresent(registration -> notificationService.createNotification(
                        registration.getUser().getId(),
                        Notification.NotificationType.WORKSHOP_CANCELLED,
                        "Workshop da bi huy",
                        "Workshop " + workshop.getTitle() + " da bi huy.",
                        Map.of(
                                "registrationId", registration.getId().toString(),
                                "workshopId", workshop.getId().toString()
                        )
                )));

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private void scheduleWorkshopUpdateNotifications(Workshop workshop, List<String> changeMessages) {
        if (changeMessages.isEmpty()) {
            return;
        }

        List<Registration> registrations = registrationRepository.findByWorkshopAndStatusIn(
                workshop,
                List.of(RegistrationStatus.CONFIRMED, RegistrationStatus.PENDING, RegistrationStatus.WAITLISTED)
        );
        if (registrations.isEmpty()) {
            return;
        }

        String changeSummary = String.join("; ", changeMessages);
        Runnable action = () -> registrations.forEach(registration -> {
            notificationCreateForWorkshopUpdate(registration, workshop, changeSummary);
            emailService.sendWorkshopUpdated(registration.getId(), changeSummary);
        });

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private void promoteWaitlistIfSeatsAvailable(Workshop workshop) {
        List<UUID> promotedRegistrationIds = new ArrayList<>();
        while (workshop.getRemainingSeats() > 0) {
            Registration promoted = registrationRepository
                    .findFirstByWorkshopAndStatusOrderByRegisteredAtAsc(workshop, RegistrationStatus.WAITLISTED)
                    .map(waitlisted -> {
                        waitlisted.setStatus(RegistrationStatus.CONFIRMED);
                        waitlisted.setQrCode(generateUniqueQrCode());
                        waitlisted.setConfirmedAt(ZonedDateTime.now());
                        waitlisted.setCancelledAt(null);
                        workshop.setRemainingSeats(workshop.getRemainingSeats() - 1);
                        registrationRepository.save(waitlisted);
                        workshopRepository.save(workshop);
                        return waitlisted;
                    })
                    .orElse(null);
            if (promoted == null) {
                break;
            }
            promotedRegistrationIds.add(promoted.getId());
        }

        if (promotedRegistrationIds.isEmpty()) {
            return;
        }

        Runnable action = () -> promotedRegistrationIds.forEach(registrationId -> {
            notificationService.createNotification(
                    registrationRepository.findById(registrationId).orElseThrow().getUser().getId(),
                    Notification.NotificationType.REGISTRATION_CONFIRMED,
                    "Da co cho trong workshop",
                    "Ban da duoc chuyen tu danh sach cho sang da xac nhan.",
                    Map.of("registrationId", registrationId.toString(), "workshopId", workshop.getId().toString())
            );
        });

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private void notificationCreateForWorkshopUpdate(Registration registration, Workshop workshop, String changeSummary) {
        notificationService.createNotification(
                registration.getUser().getId(),
                Notification.NotificationType.WORKSHOP_UPDATED,
                "Workshop da duoc cap nhat",
                workshop.getTitle() + ": " + changeSummary,
                Map.of(
                        "registrationId", registration.getId().toString(),
                        "workshopId", workshop.getId().toString(),
                        "changeSummary", changeSummary
                )
        );
    }

    private String safeValue(String value) {
        return value == null || value.isBlank() ? "(trong)" : value;
    }

    private void validateWorkshopSchedule(WorkshopRequest request) {
        ZonedDateTime now = ZonedDateTime.now();
        if (!request.getStartTime().isAfter(now)) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Thoi gian bat dau phai muon hon thoi diem hien tai");
        }
        if (!request.getEndTime().isAfter(request.getStartTime())) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Thoi gian ket thuc phai sau thoi gian bat dau");
        }
    }

    private String formatDateTime(ZonedDateTime value) {
        return value == null ? "(trong)" : value.toString();
    }

    private String generateUniqueQrCode() {
        String qrCode;
        do {
            qrCode = UUID.randomUUID().toString();
        } while (registrationRepository.existsByQrCode(qrCode));
        return qrCode;
    }
}

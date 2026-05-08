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
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
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
import java.util.EnumSet;
import java.util.Map;
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

        if (workshop.getStatus() == WorkshopStatus.CANCELLED) {
            throw new AppException(ErrorCode.FORBIDDEN, "Cannot update a cancelled workshop");
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

        return WorkshopResponse.from(workshopRepository.save(workshop));
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

        workshop.setStatus(WorkshopStatus.CANCELLED);
        workshopRepository.save(workshop);

        List<Registration> registrations = registrationRepository.findByWorkshop(workshop);
        List<UUID> cancellationEmailRegistrationIds = new ArrayList<>();
        for (Registration registration : registrations) {
            // Only refund if confirmed (or pending)
            if (registration.getStatus() == RegistrationStatus.CONFIRMED || registration.getStatus() == RegistrationStatus.PENDING) {
                registration.setStatus(RegistrationStatus.CANCELLED);
                registration.setCancelledAt(ZonedDateTime.now());
                registrationRepository.save(registration);
                cancellationEmailRegistrationIds.add(registration.getId());

                paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                        .ifPresent(payment -> {
                            if (payment.getStatus() == PaymentStatus.SUCCESS || payment.getStatus() == PaymentStatus.PENDING) {
                                payment.setStatus(PaymentStatus.REFUNDED);
                                paymentRepository.save(payment);
                            }
                        });
            } else if (registration.getStatus() == RegistrationStatus.WAITLISTED) {
                registration.setStatus(RegistrationStatus.CANCELLED);
                registration.setCancelledAt(ZonedDateTime.now());
                registrationRepository.save(registration);
                cancellationEmailRegistrationIds.add(registration.getId());
            }
        }
        scheduleWorkshopCancellationEmails(cancellationEmailRegistrationIds);
    }

    @Transactional(readOnly = true)
    public WorkshopStatisticsResponse getStatistics() {
        long totalWorkshops = workshopRepository.count();
        long totalRegistrations = registrationRepository.count();
        long totalCheckins = checkinRepository.count();
        long successfulPayments = paymentRepository.countByStatus(PaymentStatus.SUCCESS);
        BigDecimal totalRevenue = paymentRepository.sumAmountByStatus(PaymentStatus.SUCCESS);

        List<WorkshopStatisticsResponse.WorkshopRegistrationStat> breakdown = workshopRepository.findAll().stream()
                .map(workshop -> {
                    List<Registration> registrations = registrationRepository.findByWorkshop(workshop);
                    long confirmed = countByStatus(registrations, RegistrationStatus.CONFIRMED);
                    long waitlisted = countByStatus(registrations, RegistrationStatus.WAITLISTED);
                    long pending = countByStatus(registrations, RegistrationStatus.PENDING);
                    long cancelled = countByStatus(registrations, RegistrationStatus.CANCELLED);
                    long checkins = checkinRepository.countByRegistration_Workshop(workshop);
                    double checkinRate = confirmed == 0 ? 0 : (double) checkins / confirmed;
                    BigDecimal revenue = paymentRepository.sumAmountByStatusAndWorkshopId(
                            PaymentStatus.SUCCESS,
                            workshop.getId()
                    );

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
}

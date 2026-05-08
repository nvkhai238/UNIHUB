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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkshopService {

    private static final Logger log = LoggerFactory.getLogger(WorkshopService.class);

    private final WorkshopRepository workshopRepository;
    private final UserRepository userRepository;
    private final RegistrationRepository registrationRepository;
    private final PaymentRepository paymentRepository;

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
        for (Registration registration : registrations) {
            // Only refund if confirmed (or pending)
            if (registration.getStatus() == RegistrationStatus.CONFIRMED || registration.getStatus() == RegistrationStatus.PENDING) {
                registration.setStatus(RegistrationStatus.CANCELLED);
                registrationRepository.save(registration);

                paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                        .ifPresent(payment -> {
                            if (payment.getStatus() == PaymentStatus.SUCCESS || payment.getStatus() == PaymentStatus.PENDING) {
                                payment.setStatus(PaymentStatus.REFUNDED);
                                paymentRepository.save(payment);
                            }
                        });
                
                log.info("TODO: Send email notification to user {} regarding workshop cancellation and refund.", registration.getUser().getEmail());
            } else if (registration.getStatus() == RegistrationStatus.WAITLISTED) {
                registration.setStatus(RegistrationStatus.CANCELLED);
                registrationRepository.save(registration);
                log.info("TODO: Send email notification to WAITLISTED user {} regarding workshop cancellation.", registration.getUser().getEmail());
            }
        }
    }

    @Transactional(readOnly = true)
    public WorkshopStatisticsResponse getStatistics() {
        long totalWorkshops = workshopRepository.count();
        long totalRegistrations = registrationRepository.count();

        List<WorkshopStatisticsResponse.WorkshopRegistrationStat> breakdown = workshopRepository.findAll().stream()
                .map(workshop -> new WorkshopStatisticsResponse.WorkshopRegistrationStat(
                        workshop.getId(),
                        workshop.getTitle(),
                        registrationRepository.findByWorkshop(workshop).size(),
                        workshop.getCapacity()
                ))
                .toList();

        return new WorkshopStatisticsResponse(totalWorkshops, totalRegistrations, breakdown);
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
}

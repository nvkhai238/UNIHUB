package com.unihub.workshop.module.registration.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.service.PaymentService;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;
    private final UserRepository userRepository;
    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;

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
                .qrCode(UUID.randomUUID().toString())
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

            try {
                payment = paymentService.processPayment(payment);
                if (payment.getStatus() == PaymentStatus.SUCCESS) {
                    registration.setStatus(RegistrationStatus.CONFIRMED);
                    registration.setConfirmedAt(java.time.ZonedDateTime.now());
                } else if (payment.getStatus() == PaymentStatus.FAILED) {
                    registration.setStatus(RegistrationStatus.CANCELLED);
                    registration.setCancelledAt(java.time.ZonedDateTime.now());
                    workshop.setRemainingSeats(workshop.getRemainingSeats() + 1);
                    workshopRepository.save(workshop);
                }
            } catch (Exception e) {
                workshop.setRemainingSeats(workshop.getRemainingSeats() + 1);
                workshopRepository.save(workshop);
                throw e;
            }
        } else {
            registration.setStatus(RegistrationStatus.CONFIRMED);
            registration.setConfirmedAt(java.time.ZonedDateTime.now());
        }

        return RegistrationResponse.from(registrationRepository.save(registration));
    }

    @Transactional(readOnly = true)
    public List<RegistrationResponse> getMyRegistrations() {
        User user = getCurrentUser();
        return registrationRepository.findByUser(user).stream()
                .map(RegistrationResponse::from)
                .collect(Collectors.toList());
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

        try {
            payment = paymentService.processPayment(payment);
            if (payment.getStatus() == PaymentStatus.SUCCESS) {
                registration.setStatus(RegistrationStatus.CONFIRMED);
                registration.setConfirmedAt(java.time.ZonedDateTime.now());
            } else if (payment.getStatus() == PaymentStatus.FAILED) {
                registration.setStatus(RegistrationStatus.CANCELLED);
                registration.setCancelledAt(java.time.ZonedDateTime.now());
                workshop.setRemainingSeats(workshop.getRemainingSeats() + 1);
                workshopRepository.save(workshop);
            }
        } catch (Exception e) {
            if (registration.getStatus() == RegistrationStatus.CANCELLED) {
                workshop.setRemainingSeats(workshop.getRemainingSeats() + 1);
                workshopRepository.save(workshop);
            }
            throw e;
        }

        return RegistrationResponse.from(registrationRepository.save(registration));
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}

package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.notification.service.EmailService;
import com.unihub.workshop.module.payment.dto.RefundItemResponse;
import com.unihub.workshop.module.payment.dto.RefundRequestStatusUpdateRequest;
import com.unihub.workshop.module.payment.dto.RefundRequestUpsertRequest;
import com.unihub.workshop.module.payment.dto.StudentRefundRequestResponse;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.entity.RefundRequest;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.repository.RefundRequestRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.ZonedDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefundRequestService {

    private final RegistrationRepository registrationRepository;
    private final PaymentRepository paymentRepository;
    private final RefundRequestRepository refundRequestRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @Transactional(readOnly = true)
    public StudentRefundRequestResponse getMyRefundRequest(UUID registrationId) {
        RefundContext context = getStudentRefundContext(registrationId);
        return StudentRefundRequestResponse.from(
                context.registration(),
                context.payment(),
                context.refundRequest(),
                true
        );
    }

    @Transactional
    public StudentRefundRequestResponse upsertMyRefundRequest(UUID registrationId, RefundRequestUpsertRequest request) {
        RefundContext context = getStudentRefundContext(registrationId);

        RefundRequest refundRequest = context.refundRequest();
        if (refundRequest == null) {
            refundRequest = RefundRequest.builder()
                    .registration(context.registration())
                    .processed(false)
                    .build();
        } else if (Boolean.TRUE.equals(refundRequest.getProcessed())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Refund request has already been marked as completed");
        }

        applyRequest(refundRequest, request);
        RefundRequest saved = refundRequestRepository.save(refundRequest);

        return StudentRefundRequestResponse.from(
                context.registration(),
                context.payment(),
                saved,
                true
        );
    }

    @Transactional(readOnly = true)
    public Page<RefundItemResponse> getRefundQueue(UUID workshopId, Pageable pageable) {
        return paymentRepository.findRefundQueue(
                PaymentStatus.REFUNDED,
                WorkshopStatus.CANCELLED,
                workshopId,
                pageable
        ).map(payment -> {
            RefundRequest refundRequest = refundRequestRepository.findByRegistration(payment.getRegistration()).orElse(null);
            return RefundItemResponse.from(payment, refundRequest);
        });
    }

    @Transactional
    public RefundItemResponse updateRefundStatus(UUID refundRequestId, RefundRequestStatusUpdateRequest request) {
        RefundRequest refundRequest = refundRequestRepository.findById(refundRequestId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Refund request not found"));

        boolean wasProcessed = Boolean.TRUE.equals(refundRequest.getProcessed());
        boolean nextProcessed = Boolean.TRUE.equals(request.getProcessed());

        refundRequest.setProcessed(nextProcessed);
        if (nextProcessed) {
            refundRequest.setProcessedAt(ZonedDateTime.now());
            refundRequest.setProcessedBy(getCurrentUser());
        } else {
            refundRequest.setProcessedAt(null);
            refundRequest.setProcessedBy(null);
        }

        RefundRequest saved = refundRequestRepository.save(refundRequest);
        if (!wasProcessed && nextProcessed) {
            runAfterCommit(() -> emailService.sendRefundCompleted(saved.getId()));
        }

        Payment payment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(saved.getRegistration())
                .orElse(null);
        return RefundItemResponse.from(payment, saved);
    }

    private RefundContext getStudentRefundContext(UUID registrationId) {
        Registration registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new AppException(ErrorCode.REGISTRATION_NOT_FOUND));
        User user = getCurrentUser();
        if (!registration.getUser().getId().equals(user.getId())) {
            throw new AppException(ErrorCode.FORBIDDEN, "Not your registration");
        }

        Payment payment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(registration)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Refund information is unavailable"));

        if (registration.getWorkshop().getStatus() != WorkshopStatus.CANCELLED || payment.getStatus() != PaymentStatus.REFUNDED) {
            throw new AppException(ErrorCode.FORBIDDEN, "This registration is not eligible for refund submission");
        }

        RefundRequest refundRequest = refundRequestRepository.findByRegistration(registration).orElse(null);
        return new RefundContext(registration, payment, refundRequest);
    }

    private void applyRequest(RefundRequest entity, RefundRequestUpsertRequest request) {
        entity.setBankName(request.getBankName().trim());
        entity.setBankAccountName(request.getBankAccountName().trim());
        entity.setBankAccountNumber(request.getBankAccountNumber().trim());
        entity.setProofUrl(request.getProofUrl().trim());
        entity.setProofNote(request.getProofNote() == null ? null : request.getProofNote().trim());
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
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

    private record RefundContext(
            Registration registration,
            Payment payment,
            RefundRequest refundRequest
    ) {}
}

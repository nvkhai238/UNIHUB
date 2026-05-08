package com.unihub.workshop.module.payment.service;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class PaymentTimeoutScheduler {

    private final PaymentRepository paymentRepository;
    private final RegistrationRepository registrationRepository;
    private final WorkshopRepository workshopRepository;

    @Value("${app.payment.pending-timeout-minutes:15}")
    private long pendingTimeoutMinutes;

    @Scheduled(fixedDelayString = "${app.payment.pending-timeout-scan-ms:60000}")
    @Transactional
    public void expireStalePendingPayments() {
        ZonedDateTime cutoff = ZonedDateTime.now().minus(Duration.ofMinutes(pendingTimeoutMinutes));
        List<Payment> stalePayments = paymentRepository.findByStatusAndCreatedAtBefore(PaymentStatus.PENDING, cutoff);

        for (Payment payment : stalePayments) {
            Registration registration = payment.getRegistration();
            if (registration.getStatus() != RegistrationStatus.PENDING) {
                continue;
            }

            payment.setStatus(PaymentStatus.FAILED);
            payment.setGatewayResponse("{\"status\":\"EXPIRED\",\"reason\":\"PENDING_PAYMENT_TIMEOUT\"}");
            paymentRepository.save(payment);

            registration.setStatus(RegistrationStatus.CANCELLED);
            registration.setCancelledAt(ZonedDateTime.now());
            registrationRepository.save(registration);

            Workshop workshop = workshopRepository.findByIdForUpdate(registration.getWorkshop().getId())
                    .orElse(registration.getWorkshop());
            workshop.setRemainingSeats(workshop.getRemainingSeats() + 1);
            workshopRepository.save(workshop);
        }
    }
}

package com.unihub.workshop.module.payment.repository;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.registration.entity.Registration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Optional<Payment> findTopByRegistrationOrderByCreatedAtDesc(Registration registration);
}

package com.unihub.workshop.module.payment.repository;

import com.unihub.workshop.module.payment.entity.RefundRequest;
import com.unihub.workshop.module.registration.entity.Registration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefundRequestRepository extends JpaRepository<RefundRequest, UUID> {
    Optional<RefundRequest> findByRegistration(Registration registration);
    List<RefundRequest> findByRegistration_IdIn(Collection<UUID> registrationIds);
}

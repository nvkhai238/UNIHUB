package com.unihub.workshop.module.payment.repository;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.registration.entity.Registration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Optional<Payment> findTopByRegistrationOrderByCreatedAtDesc(Registration registration);
    List<Payment> findByStatusAndCreatedAtBefore(PaymentStatus status, ZonedDateTime cutoff);

    long countByStatus(PaymentStatus status);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.status = :status")
    BigDecimal sumAmountByStatus(@Param("status") PaymentStatus status);

    @Query("""
            select coalesce(sum(p.amount), 0)
            from Payment p
            where p.status = :status
              and p.registration.workshop.id = :workshopId
            """)
    BigDecimal sumAmountByStatusAndWorkshopId(
            @Param("status") PaymentStatus status,
            @Param("workshopId") UUID workshopId
    );
}

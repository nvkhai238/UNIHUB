package com.unihub.workshop.module.payment.repository;

import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    List<Payment> findByRegistration(Registration registration);
    Optional<Payment> findByGatewayRef(String gatewayRef);
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

    // ─── Filtered queries for payment stats ─────────────────────────────────────

    @Query("""
            select count(p) from Payment p
            where (:status is null or p.status = :status)
              and (:workshopId is null or p.registration.workshop.id = :workshopId)
              and (:from is null or p.createdAt >= :from)
              and (:to is null or p.createdAt <= :to)
            """)
    long countFiltered(
            @Param("status") PaymentStatus status,
            @Param("workshopId") UUID workshopId,
            @Param("from") ZonedDateTime from,
            @Param("to") ZonedDateTime to
    );

    @Query("""
            select coalesce(sum(p.amount), 0) from Payment p
            where p.status = :status
              and (:workshopId is null or p.registration.workshop.id = :workshopId)
              and (:from is null or p.createdAt >= :from)
              and (:to is null or p.createdAt <= :to)
            """)
    BigDecimal sumAmountFiltered(
            @Param("status") PaymentStatus status,
            @Param("workshopId") UUID workshopId,
            @Param("from") ZonedDateTime from,
            @Param("to") ZonedDateTime to
    );

    @Query("""
            select count(p) from Payment p
            where p.status = :status
              and (:workshopId is null or p.registration.workshop.id = :workshopId)
              and (:from is null or p.createdAt >= :from)
              and (:to is null or p.createdAt <= :to)
            """)
    long countByStatusFiltered(
            @Param("status") PaymentStatus status,
            @Param("workshopId") UUID workshopId,
            @Param("from") ZonedDateTime from,
            @Param("to") ZonedDateTime to
    );

    @Query("""
            select p
            from Payment p
            where p.status = :paymentStatus
              and p.registration.workshop.status = :workshopStatus
              and (:workshopId is null or p.registration.workshop.id = :workshopId)
            """)
    Page<Payment> findRefundQueue(
            @Param("paymentStatus") PaymentStatus paymentStatus,
            @Param("workshopStatus") WorkshopStatus workshopStatus,
            @Param("workshopId") UUID workshopId,
            Pageable pageable
    );
}

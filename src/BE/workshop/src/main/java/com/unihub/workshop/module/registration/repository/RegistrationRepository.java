package com.unihub.workshop.module.registration.repository;

import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.workshop.entity.Workshop;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RegistrationRepository extends JpaRepository<Registration, UUID> {
    boolean existsByUserAndWorkshopAndStatusNot(User user, Workshop workshop, RegistrationStatus status);
    
    long countByWorkshopAndStatus(Workshop workshop, RegistrationStatus status);
    Optional<Registration> findByUserAndWorkshop(User user, Workshop workshop);
    boolean existsByQrCode(String qrCode);
    Page<Registration> findByUserOrderByRegisteredAtDesc(User user, Pageable pageable);
    Page<Registration> findByWorkshopOrderByRegisteredAtDesc(Workshop workshop, Pageable pageable);
    Page<Registration> findByWorkshopAndStatusOrderByRegisteredAtDesc(Workshop workshop, RegistrationStatus status, Pageable pageable);
    Optional<Registration> findTopByUserAndWorkshopAndStatusNotOrderByRegisteredAtDesc(User user, Workshop workshop, RegistrationStatus status);
    
    // Legacy non-paginated queries used by internal logic
    List<Registration> findByUser(User user);
    List<Registration> findByWorkshop(Workshop workshop);
    List<Registration> findByWorkshopAndStatusIn(Workshop workshop, List<RegistrationStatus> statuses);
    Optional<Registration> findByQrCode(String qrCode);
    List<Registration> findByStatusAndQrCodeIsNotNull(RegistrationStatus status);
    List<Registration> findByStatusAndWorkshop_StartTimeBetween(RegistrationStatus status, ZonedDateTime start, ZonedDateTime end);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<Registration> findFirstByWorkshopAndStatusOrderByRegisteredAtAsc(Workshop workshop, RegistrationStatus status);
}

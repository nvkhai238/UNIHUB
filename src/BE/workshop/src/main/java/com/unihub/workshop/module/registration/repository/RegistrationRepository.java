package com.unihub.workshop.module.registration.repository;

import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.workshop.entity.Workshop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RegistrationRepository extends JpaRepository<Registration, UUID> {
    boolean existsByUserAndWorkshop(User user, Workshop workshop);
    boolean existsByQrCode(String qrCode);
    List<Registration> findByUser(User user);
    List<Registration> findByWorkshop(Workshop workshop);
    Optional<Registration> findByQrCode(String qrCode);
    List<Registration> findByStatusAndWorkshop_StartTimeBetween(RegistrationStatus status, ZonedDateTime start, ZonedDateTime end);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    Optional<Registration> findFirstByWorkshopAndStatusOrderByRegisteredAtAsc(Workshop workshop, RegistrationStatus status);
}

package com.unihub.workshop.module.registration.repository;

import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.workshop.entity.Workshop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RegistrationRepository extends JpaRepository<Registration, UUID> {
    boolean existsByUserAndWorkshop(User user, Workshop workshop);
    List<Registration> findByUser(User user);
    Optional<Registration> findByQrCode(String qrCode);
    List<Registration> findByStatusAndWorkshop_StartTimeBetween(RegistrationStatus status, ZonedDateTime start, ZonedDateTime end);
}

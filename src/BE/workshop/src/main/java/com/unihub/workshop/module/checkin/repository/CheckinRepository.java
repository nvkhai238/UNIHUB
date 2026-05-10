package com.unihub.workshop.module.checkin.repository;

import com.unihub.workshop.module.checkin.entity.Checkin;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.workshop.entity.Workshop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CheckinRepository extends JpaRepository<Checkin, UUID> {
    boolean existsByRegistration(Registration registration);
    Optional<Checkin> findByRegistration(Registration registration);
    long countByRegistration_Workshop(Workshop workshop);
    List<Checkin> findByRegistration_WorkshopOrderByCheckedInAtDesc(Workshop workshop);
}

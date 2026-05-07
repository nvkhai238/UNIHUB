package com.unihub.workshop.module.checkin.repository;

import com.unihub.workshop.module.checkin.entity.Checkin;
import com.unihub.workshop.module.registration.entity.Registration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CheckinRepository extends JpaRepository<Checkin, UUID> {
    boolean existsByRegistration(Registration registration);
}

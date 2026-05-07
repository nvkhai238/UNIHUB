package com.unihub.workshop.module.workshop.repository;

import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface WorkshopRepository extends JpaRepository<Workshop, UUID> {
    Page<Workshop> findByStatus(WorkshopStatus status, Pageable pageable);
    Page<Workshop> findAllByStatusIn(java.util.List<WorkshopStatus> statuses, Pageable pageable);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Workshop w WHERE w.id = :id")
    Optional<Workshop> findByIdForUpdate(@Param("id") UUID id);
}

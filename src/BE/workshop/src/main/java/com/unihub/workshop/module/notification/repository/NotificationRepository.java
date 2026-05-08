package com.unihub.workshop.module.notification.repository;

import com.unihub.workshop.module.notification.entity.Notification;
import com.unihub.workshop.module.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.ZonedDateTime;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);

    Page<Notification> findByUserAndReadOrderByCreatedAtDesc(boolean unread, User user, Pageable pageable);

    long countByUserAndReadFalse(User user);

    @Modifying
    @Query("update Notification n set n.read = true where n.user = :user and n.read = false")
    int markAllAsRead(@Param("user") User user);

    @Modifying
    @Query("delete from Notification n where n.user = :user and n.createdAt < :before")
    int deleteOlderThan(@Param("user") User user, @Param("before") ZonedDateTime before);
}

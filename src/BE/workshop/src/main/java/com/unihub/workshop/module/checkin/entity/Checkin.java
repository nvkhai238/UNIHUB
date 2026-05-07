package com.unihub.workshop.module.checkin.entity;

import com.unihub.workshop.module.registration.entity.Registration;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "checkins",
    uniqueConstraints = @UniqueConstraint(columnNames = {"registration_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Checkin {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registration_id", nullable = false)
    private Registration registration;

    @Column(name = "checked_in_at", nullable = false)
    private ZonedDateTime checkedInAt;

    @Column(name = "synced_at")
    private ZonedDateTime syncedAt;

    @Column(name = "device_id", length = 255)
    private String deviceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private ZonedDateTime createdAt;
}

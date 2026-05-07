package com.unihub.workshop.module.registration.entity;

import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.workshop.entity.Workshop;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "registrations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "workshop_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Registration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workshop_id", nullable = false)
    private Workshop workshop;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private RegistrationStatus status;

    @Column(name = "qr_code", unique = true, length = 255)
    private String qrCode;

    @CreationTimestamp
    @Column(name = "registered_at", nullable = false, updatable = false)
    private ZonedDateTime registeredAt;

    @Column(name = "confirmed_at")
    private ZonedDateTime confirmedAt;

    @Column(name = "cancelled_at")
    private ZonedDateTime cancelledAt;
}

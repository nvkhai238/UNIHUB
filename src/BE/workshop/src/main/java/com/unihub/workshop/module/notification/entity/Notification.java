package com.unihub.workshop.module.notification.entity;

import com.unihub.workshop.common.entity.BaseEntity;
import com.unihub.workshop.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 50)
    private NotificationType type;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean read = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data", columnDefinition = "jsonb")
    private Map<String, Object> data;

    public enum NotificationType {
        REGISTRATION_CONFIRMED,
        REGISTRATION_PENDING,
        REGISTRATION_CANCELLED,
        WORKSHOP_CANCELLED,
        WORKSHOP_UPDATED,
        PAYMENT_PENDING,
        PAYMENT_SUCCESS,
        PAYMENT_FAILED,
        CHECKIN_SUCCESS,
        REMINDER,
        NEW_REGISTRATION
    }
}

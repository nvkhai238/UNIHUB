package com.unihub.workshop.module.payment.entity;

import com.unihub.workshop.common.entity.BaseEntity;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;

@Entity
@Table(
        name = "refund_requests",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_refund_requests_registration", columnNames = "registration_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundRequest extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registration_id", nullable = false, unique = true)
    private Registration registration;

    @Column(name = "bank_name", nullable = false, length = 255)
    private String bankName;

    @Column(name = "bank_account_name", nullable = false, length = 255)
    private String bankAccountName;

    @Column(name = "bank_account_number", nullable = false, length = 50)
    private String bankAccountNumber;

    @Column(name = "proof_url", nullable = false, length = 1000)
    private String proofUrl;

    @Column(name = "proof_note", columnDefinition = "TEXT")
    private String proofNote;

    @Column(name = "processed", nullable = false)
    private Boolean processed;

    @Column(name = "processed_at")
    private ZonedDateTime processedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processed_by_user_id")
    private User processedBy;
}

package com.unihub.workshop.module.workshop.entity;

import com.unihub.workshop.common.entity.BaseEntity;
import com.unihub.workshop.module.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "workshops")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Workshop extends BaseEntity {

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "speaker_name", length = 255)
    private String speakerName;

    @Column(name = "speaker_bio", columnDefinition = "TEXT")
    private String speakerBio;

    @Column(name = "room", nullable = false, length = 100)
    private String room;

    @Column(name = "room_layout_url", columnDefinition = "TEXT")
    private String roomLayoutUrl;

    @Column(name = "start_time", nullable = false)
    private ZonedDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private ZonedDateTime endTime;

    @Column(name = "capacity", nullable = false)
    private Integer capacity;

    @Column(name = "remaining_seats", nullable = false)
    private Integer remainingSeats;

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WorkshopStatus status;

    @Column(name = "pdf_url", columnDefinition = "TEXT")
    private String pdfUrl;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "ai_summary_status", length = 20)
    private String aiSummaryStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;
}

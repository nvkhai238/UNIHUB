package com.unihub.workshop.module.studentimport.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.ZonedDateTime;
import java.util.UUID;

@Entity
@Table(name = "student_import_batches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "file_name", length = 500)
    private String fileName;

    @Column(name = "total_rows")
    private Integer totalRows;

    @Column(name = "success_rows")
    private Integer successRows;

    @Column(name = "error_rows")
    private Integer errorRows;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "error_log", columnDefinition = "TEXT")
    private String errorLog;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private ZonedDateTime startedAt;

    @Column(name = "completed_at")
    private ZonedDateTime completedAt;
}

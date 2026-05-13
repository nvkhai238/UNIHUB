package com.unihub.workshop.module.csvimport.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.csvimport.scheduler.CsvImportScheduler;
import com.unihub.workshop.module.studentimport.entity.StudentImportBatch;
import com.unihub.workshop.module.studentimport.repository.StudentImportBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/student-imports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ORGANIZER')")
public class StudentImportController {

    private final CsvImportScheduler csvImportScheduler;
    private final StudentImportBatchRepository batchRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<StudentImportBatch>>> listBatches() {
        return ResponseEntity.ok(ApiResponse.success(batchRepository.findAllByOrderByStartedAtDesc()));
    }

    @PostMapping("/run")
    public ResponseEntity<ApiResponse<StudentImportBatch>> runImport() {
        return ResponseEntity.ok(ApiResponse.success("Student CSV import completed", csvImportScheduler.runManualImportJob()));
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLatestStatus() {
        return ResponseEntity.ok(ApiResponse.success(toStatusPayload(
                batchRepository.findFirstByOrderByStartedAtDesc().orElse(null)
        )));
    }

    static Map<String, Object> toStatusPayload(StudentImportBatch latestBatch) {
        if (latestBatch == null) {
            return Map.of(
                    "jobId", "",
                    "status", "NOT_STARTED",
                    "processedRecords", 0,
                    "failedRecords", 0
            );
        }

        return Map.of(
                "jobId", latestBatch.getId(),
                "status", latestBatch.getStatus(),
                "processedRecords", latestBatch.getSuccessRows() != null ? latestBatch.getSuccessRows() : 0,
                "failedRecords", latestBatch.getErrorRows() != null ? latestBatch.getErrorRows() : 0
        );
    }
}

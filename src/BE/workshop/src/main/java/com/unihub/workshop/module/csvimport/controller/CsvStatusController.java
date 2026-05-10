package com.unihub.workshop.module.csvimport.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.studentimport.entity.StudentImportBatch;
import com.unihub.workshop.module.studentimport.repository.StudentImportBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class CsvStatusController {

    private final StudentImportBatchRepository batchRepository;

    @GetMapping("/api/csv/status")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<StudentImportBatch>> getLatestImportStatus() {
        return ResponseEntity.ok(ApiResponse.success(
                batchRepository.findFirstByOrderByStartedAtDesc().orElse(null)
        ));
    }
}

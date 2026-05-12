package com.unihub.workshop.module.workshop.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.workshop.dto.ChangeStatusRequest;
import com.unihub.workshop.module.workshop.dto.WorkshopRequest;
import com.unihub.workshop.module.workshop.dto.WorkshopResponse;
import com.unihub.workshop.module.workshop.dto.WorkshopStatisticsResponse;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import com.unihub.workshop.module.workshop.service.AiSummaryService;
import com.unihub.workshop.module.workshop.service.SupabaseStorageService;
import com.unihub.workshop.module.workshop.service.WorkshopService;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.service.RegistrationService;
import com.unihub.workshop.module.registration.dto.RegistrationResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/workshops")
@RequiredArgsConstructor
public class WorkshopController {

    private final WorkshopService workshopService;
    private final SupabaseStorageService supabaseStorageService;
    private final AiSummaryService aiSummaryService;
    private final WorkshopRepository workshopRepository;
    private final RegistrationService registrationService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<WorkshopResponse>>> getPublished(
            @PageableDefault(size = 10, sort = "startTime", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(workshopService.findPublished(pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WorkshopResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(workshopService.findById(id)));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<Page<WorkshopResponse>>> getAll(
            @RequestParam(required = false) WorkshopStatus status,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(workshopService.findAll(status, pageable)));
    }

    @GetMapping("/statistics")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<WorkshopStatisticsResponse>> getStatistics() {
        return ResponseEntity.ok(ApiResponse.success(workshopService.getStatistics()));
    }

    @GetMapping("/{id}/registrations")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<Page<RegistrationResponse>>> getWorkshopRegistrations(
            @PathVariable UUID id,
            @RequestParam(required = false) RegistrationStatus status,
            @PageableDefault(size = 20, sort = "registeredAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.getRegistrationsByWorkshop(id, status, pageable)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<Void>> cancel(@PathVariable UUID id) {
        workshopService.cancel(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<WorkshopResponse>> create(@Valid @RequestBody WorkshopRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<WorkshopResponse>builder()
                        .status(201)
                        .code("SUCCESS")
                        .message("Workshop created")
                        .data(workshopService.create(request))
                        .build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<WorkshopResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody WorkshopRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(workshopService.update(id, request)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<WorkshopResponse>> changeStatus(
            @PathVariable UUID id,
            @Valid @RequestBody ChangeStatusRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(workshopService.changeStatus(id, request)));
    }

    @PostMapping(value = "/{id}/pdf", consumes = {"multipart/form-data"})
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<String>> uploadPdf(@PathVariable UUID id, @RequestParam("file") MultipartFile file) {
        validatePdfUpload(file);

        com.unihub.workshop.module.workshop.entity.Workshop workshop = workshopRepository.findById(id)
                .orElseThrow(() -> new com.unihub.workshop.common.exception.AppException(com.unihub.workshop.common.exception.ErrorCode.WORKSHOP_NOT_FOUND));
        if (workshop.getStatus() == WorkshopStatus.CANCELLED) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.FORBIDDEN,
                    "Cannot upload PDF for a cancelled workshop"
            );
        }

        String pdfUrl = supabaseStorageService.uploadPdf(id, file);

        workshop.setPdfUrl(pdfUrl);
        workshop.setAiSummaryStatus("PROCESSING");
        workshop.setAiSummary(null);
        workshopRepository.save(workshop);

        aiSummaryService.processAsync(id, pdfUrl);

        return ResponseEntity.status(org.springframework.http.HttpStatus.ACCEPTED)
                .body(ApiResponse.success("File uploaded successfully and AI summary is processing", pdfUrl));
    }

    @GetMapping("/{id}/ai-summary/status")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<WorkshopResponse>> getAiSummaryStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(workshopService.findById(id)));
    }

    @PostMapping("/{id}/ai-summary/retry")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<WorkshopResponse>> retryAiSummary(@PathVariable UUID id) {
        com.unihub.workshop.module.workshop.entity.Workshop workshop = workshopRepository.findById(id)
                .orElseThrow(() -> new com.unihub.workshop.common.exception.AppException(com.unihub.workshop.common.exception.ErrorCode.WORKSHOP_NOT_FOUND));
        if (!StringUtils.hasText(workshop.getPdfUrl())) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.VALIDATION_FAILED,
                    "Workshop has no PDF to summarize"
            );
        }
        if ("DONE".equals(workshop.getAiSummaryStatus())) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.FORBIDDEN,
                    "AI summary is already done"
            );
        }

        workshop.setAiSummaryStatus("PROCESSING");
        workshop.setAiSummary(null);
        workshopRepository.save(workshop);
        aiSummaryService.processAsync(id, workshop.getPdfUrl());

        return ResponseEntity.accepted()
                .body(ApiResponse.success("AI summary retry started", WorkshopResponse.from(workshop)));
    }

    private void validatePdfUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.VALIDATION_FAILED,
                    "PDF file is required"
            );
        }
        if (file.getSize() > 10L * 1024L * 1024L) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.VALIDATION_FAILED,
                    "PDF file must be 10MB or smaller"
            );
        }
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean looksLikePdf = "application/pdf".equalsIgnoreCase(contentType)
                || (filename != null && filename.toLowerCase().endsWith(".pdf"));
        if (!looksLikePdf) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.VALIDATION_FAILED,
                    "Only PDF files are allowed"
            );
        }
    }
}

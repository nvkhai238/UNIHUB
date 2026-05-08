package com.unihub.workshop.module.workshop.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.workshop.dto.ChangeStatusRequest;
import com.unihub.workshop.module.workshop.dto.WorkshopRequest;
import com.unihub.workshop.module.workshop.dto.WorkshopResponse;
import com.unihub.workshop.module.workshop.dto.WorkshopStatisticsResponse;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.service.WorkshopService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/workshops")
@RequiredArgsConstructor
public class WorkshopController {

    private final WorkshopService workshopService;

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
    public ResponseEntity<ApiResponse<String>> uploadPdf(
            @PathVariable UUID id,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @org.springframework.beans.factory.annotation.Autowired com.unihub.workshop.module.workshop.service.SupabaseStorageService supabaseStorageService,
            @org.springframework.beans.factory.annotation.Autowired com.unihub.workshop.module.workshop.service.AiSummaryService aiSummaryService,
            @org.springframework.beans.factory.annotation.Autowired com.unihub.workshop.module.workshop.repository.WorkshopRepository workshopRepository
    ) {
        String pdfUrl = supabaseStorageService.uploadPdf(id, file);

        com.unihub.workshop.module.workshop.entity.Workshop workshop = workshopRepository.findById(id)
                .orElseThrow(() -> new com.unihub.workshop.common.exception.AppException(com.unihub.workshop.common.exception.ErrorCode.WORKSHOP_NOT_FOUND));
        
        workshop.setPdfUrl(pdfUrl);
        workshop.setAiSummaryStatus("PROCESSING");
        workshopRepository.save(workshop);

        aiSummaryService.processAsync(id, pdfUrl);

        return ResponseEntity.status(org.springframework.http.HttpStatus.ACCEPTED)
                .body(ApiResponse.success("File uploaded successfully and AI summary is processing", pdfUrl));
    }
}

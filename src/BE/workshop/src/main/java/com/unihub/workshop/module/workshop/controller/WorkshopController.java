package com.unihub.workshop.module.workshop.controller;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.workshop.dto.AiSummaryResponse;
import com.unihub.workshop.module.workshop.dto.ChangeStatusRequest;
import com.unihub.workshop.module.workshop.dto.PdfUploadResponse;
import com.unihub.workshop.module.workshop.dto.WorkshopRequest;
import com.unihub.workshop.module.workshop.dto.WorkshopResponse;
import com.unihub.workshop.module.workshop.dto.WorkshopStatisticsResponse;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import com.unihub.workshop.module.workshop.service.AiSummaryService;
import com.unihub.workshop.module.workshop.service.SupabaseStorageService;
import com.unihub.workshop.module.workshop.service.WorkshopService;
import com.unihub.workshop.module.workshop.service.WorkshopReadSlidingWindowService;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.service.RegistrationService;
import com.unihub.workshop.module.registration.dto.RegistrationResponse;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
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
    private final WorkshopReadSlidingWindowService workshopReadSlidingWindowService;

    @GetMapping
    @RateLimiter(name = "workshop-read", fallbackMethod = "workshopReadRateLimitFallback")
    public ResponseEntity<ApiResponse<Page<WorkshopResponse>>> getPublished(
            HttpServletRequest request,
            Authentication authentication,
            @PageableDefault(size = 10, sort = "startTime", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        enforceWorkshopReadWindow(request, authentication);
        return ResponseEntity.ok(ApiResponse.success(workshopService.findPublished(pageable)));
    }

    @GetMapping("/{id}")
    @RateLimiter(name = "workshop-read", fallbackMethod = "workshopDetailRateLimitFallback")
    public ResponseEntity<ApiResponse<WorkshopResponse>> getById(
            @PathVariable UUID id,
            HttpServletRequest request,
            Authentication authentication
    ) {
        enforceWorkshopReadWindow(request, authentication);
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
    public ResponseEntity<ApiResponse<WorkshopStatisticsResponse>> getStatistics(
            @RequestParam(required = false) UUID workshopId,
            @RequestParam(required = false) WorkshopStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) java.time.ZonedDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) java.time.ZonedDateTime to
    ) {
        return ResponseEntity.ok(ApiResponse.success(workshopService.getStatistics(workshopId, status, from, to)));
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
    public ResponseEntity<ApiResponse<PdfUploadResponse>> uploadPdf(@PathVariable UUID id, @RequestParam("file") MultipartFile file) {
        validatePdfUpload(file);

        com.unihub.workshop.module.workshop.entity.Workshop workshop = workshopRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));
        if (workshop.getStatus() == WorkshopStatus.CANCELLED) {
            throw new AppException(ErrorCode.WORKSHOP_CANCELLED, "Cannot upload PDF for a cancelled workshop");
        }
        if (workshop.getStatus() != WorkshopStatus.DRAFT && workshop.getStatus() != WorkshopStatus.PUBLISHED) {
            throw new AppException(ErrorCode.FORBIDDEN, "Cannot upload PDF for this workshop status");
        }
        if ("PROCESSING".equalsIgnoreCase(workshop.getAiSummaryStatus())) {
            throw new AppException(ErrorCode.SUMMARY_ALREADY_PROCESSING, "AI summary is already processing");
        }

        String pdfUrl = supabaseStorageService.uploadPdf(id, file);

        workshop.setPdfUrl(pdfUrl);
        workshop.setAiSummaryStatus("PROCESSING");
        workshop.setAiSummary(null);
        workshopRepository.save(workshop);

        aiSummaryService.processAsync(id, pdfUrl);

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.<PdfUploadResponse>builder()
                        .status(202)
                        .code("SUCCESS")
                        .message("PDF đang xử lý tóm tắt AI.")
                        .data(PdfUploadResponse.builder()
                                .pdfUrl(pdfUrl)
                                .aiSummaryStatus(workshop.getAiSummaryStatus())
                                .build())
                        .build());
    }

    @GetMapping({"/{id}/ai-summary", "/{id}/ai-summary/status"})
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<AiSummaryResponse>> getAiSummaryStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(AiSummaryResponse.from(workshopService.findById(id))));
    }

    @PostMapping("/{id}/ai-summary/retry")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<AiSummaryResponse>> retryAiSummary(@PathVariable UUID id) {
        com.unihub.workshop.module.workshop.entity.Workshop workshop = workshopRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.WORKSHOP_NOT_FOUND));
        if (!StringUtils.hasText(workshop.getPdfUrl())) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Workshop has no PDF to summarize");
        }
        if (workshop.getStatus() == WorkshopStatus.CANCELLED) {
            throw new AppException(ErrorCode.WORKSHOP_CANCELLED, "Cannot retry AI summary for a cancelled workshop");
        }
        if (workshop.getStatus() != WorkshopStatus.DRAFT && workshop.getStatus() != WorkshopStatus.PUBLISHED) {
            throw new AppException(ErrorCode.FORBIDDEN, "Cannot retry AI summary for this workshop status");
        }
        String currentStatus = normalizeAiSummaryStatus(workshop.getAiSummaryStatus());
        if ("PROCESSING".equals(currentStatus)) {
            throw new AppException(ErrorCode.SUMMARY_ALREADY_PROCESSING, "AI summary is already processing");
        }
        if ("DONE".equals(currentStatus)) {
            throw new AppException(ErrorCode.SUMMARY_ALREADY_DONE, "AI summary is already done");
        }
        if (!"FAILED".equals(currentStatus)) {
            throw new AppException(ErrorCode.SUMMARY_NOT_FAILED, "AI summary can only be retried after a failed attempt");
        }

        workshop.setAiSummaryStatus("PROCESSING");
        workshopRepository.save(workshop);
        aiSummaryService.processAsync(id, workshop.getPdfUrl());

        return ResponseEntity.accepted()
                .body(ApiResponse.<AiSummaryResponse>builder()
                        .status(202)
                        .code("SUCCESS")
                        .message("AI summary retry started")
                        .data(AiSummaryResponse.from(workshop))
                        .build());
    }

    private void validatePdfUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_FILE, "PDF file is required");
        }
        if (file.getSize() > 10L * 1024L * 1024L) {
            throw new AppException(ErrorCode.INVALID_FILE, "PDF file must be 10MB or smaller");
        }
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean hasPdfMetadata = "application/pdf".equalsIgnoreCase(contentType)
                || (filename != null && filename.toLowerCase().endsWith(".pdf"));
        if (!hasPdfMetadata || !hasPdfSignature(file)) {
            throw new AppException(ErrorCode.INVALID_FILE, "Only PDF files are allowed");
        }
    }

    private boolean hasPdfSignature(MultipartFile file) {
        try {
            byte[] signature = file.getInputStream().readNBytes(5);
            return "%PDF-".equals(new String(signature, StandardCharsets.US_ASCII));
        } catch (IOException e) {
            return false;
        }
    }

    public ResponseEntity<ApiResponse<Page<WorkshopResponse>>> workshopReadRateLimitFallback(
            Pageable pageable,
            RequestNotPermitted ex
    ) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "10")
                .body(ApiResponse.error(
                        429,
                        "RATE_LIMIT_EXCEEDED",
                        "Too many workshop requests. Please retry after 10 seconds."
                ));
    }

    public ResponseEntity<ApiResponse<WorkshopResponse>> workshopDetailRateLimitFallback(
            UUID id,
            RequestNotPermitted ex
    ) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "10")
                .body(ApiResponse.error(
                        429,
                        "RATE_LIMIT_EXCEEDED",
                        "Too many workshop requests. Please retry after 10 seconds."
                ));
    }

    private void enforceWorkshopReadWindow(HttpServletRequest request, Authentication authentication) {
        String principalKey = authentication != null && authentication.isAuthenticated()
                ? authentication.getName()
                : extractClientIp(request);
        if (!workshopReadSlidingWindowService.tryAcquire(principalKey)) {
            throw new com.unihub.workshop.common.exception.AppException(
                    com.unihub.workshop.common.exception.ErrorCode.RATE_LIMIT_EXCEEDED,
                    "Too many workshop requests in the current sliding window"
            );
        }
    }

    private String normalizeAiSummaryStatus(String status) {
        return StringUtils.hasText(status) ? status.toUpperCase() : "NONE";
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

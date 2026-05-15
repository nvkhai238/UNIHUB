package com.unihub.workshop.module.payment.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.payment.dto.CircuitBreakerStatusResponse;
import com.unihub.workshop.module.payment.dto.PagedResponse;
import com.unihub.workshop.module.payment.dto.RefundRequestStatusUpdateRequest;
import com.unihub.workshop.module.payment.dto.PaymentStatusResponse;
import com.unihub.workshop.module.payment.dto.PaymentStatsResponse;
import com.unihub.workshop.module.payment.dto.RefundItemResponse;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.service.CircuitBreakerStatusService;
import com.unihub.workshop.module.payment.service.PaymentService;
import com.unihub.workshop.module.payment.service.RefundRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final CircuitBreakerStatusService circuitBreakerStatusService;
    private final RefundRequestService refundRequestService;

    @GetMapping("/api/registrations/{registrationId}/payment-status")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<PaymentStatusResponse>> getPaymentStatus(
            @PathVariable UUID registrationId
    ) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPaymentStatus(registrationId)));
    }

    @GetMapping("/api/registrations/{registrationId}/payment-info")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<com.unihub.workshop.module.payment.dto.PaymentInfoResponse>> getPaymentInfo(
            @PathVariable UUID registrationId
    ) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPaymentInfo(registrationId)));
    }

    @GetMapping("/api/admin/payments/stats")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<PaymentStatsResponse>> getPaymentStats(
            @RequestParam(required = false) UUID workshopId,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) ZonedDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) ZonedDateTime to
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentService.getPaymentStats(workshopId, status, from, to)
        ));
    }

    @GetMapping("/api/admin/refunds")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<PagedResponse<RefundItemResponse>>> getRefundQueue(
            @RequestParam(required = false) UUID workshopId,
            @PageableDefault(size = 10, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                PagedResponse.from(refundRequestService.getRefundQueue(workshopId, pageable))
        ));
    }

    @PatchMapping("/api/admin/refunds/{refundRequestId}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<RefundItemResponse>> updateRefundStatus(
            @PathVariable UUID refundRequestId,
            @Valid @RequestBody RefundRequestStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                refundRequestService.updateRefundStatus(refundRequestId, request)
        ));
    }

    @GetMapping("/api/admin/payments/circuit-breaker-status")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<ApiResponse<CircuitBreakerStatusResponse>> getCircuitBreakerStatus() {
        return ResponseEntity.ok(ApiResponse.success(
                circuitBreakerStatusService.getPaymentCircuitBreakerStatus()
        ));
    }
}

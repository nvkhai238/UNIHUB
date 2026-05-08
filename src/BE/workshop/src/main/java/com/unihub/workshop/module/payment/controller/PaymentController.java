package com.unihub.workshop.module.payment.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.payment.dto.PaymentStatusResponse;
import com.unihub.workshop.module.payment.dto.PaymentStatsResponse;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.service.PaymentService;
import lombok.RequiredArgsConstructor;
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

    @GetMapping("/api/registrations/{registrationId}/payment-status")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<PaymentStatusResponse>> getPaymentStatus(
            @PathVariable UUID registrationId
    ) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getPaymentStatus(registrationId)));
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
}

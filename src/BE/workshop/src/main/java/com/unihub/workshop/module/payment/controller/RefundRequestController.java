package com.unihub.workshop.module.payment.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.payment.dto.RefundRequestUpsertRequest;
import com.unihub.workshop.module.payment.dto.StudentRefundRequestResponse;
import com.unihub.workshop.module.payment.service.RefundRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/refunds")
public class RefundRequestController {

    private final RefundRequestService refundRequestService;

    @GetMapping("/my/registrations/{registrationId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentRefundRequestResponse>> getMyRefundRequest(@PathVariable UUID registrationId) {
        return ResponseEntity.ok(ApiResponse.success(
                refundRequestService.getMyRefundRequest(registrationId)
        ));
    }

    @PostMapping("/my/registrations/{registrationId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentRefundRequestResponse>> upsertMyRefundRequest(
            @PathVariable UUID registrationId,
            @Valid @RequestBody RefundRequestUpsertRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                refundRequestService.upsertMyRefundRequest(registrationId, request)
        ));
    }
}

package com.unihub.workshop.module.registration.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.registration.dto.RegistrationRequest;
import com.unihub.workshop.module.registration.dto.RegistrationResponse;
import com.unihub.workshop.module.registration.service.IdempotencyService;
import com.unihub.workshop.module.registration.service.RegistrationService;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/registrations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class RegistrationController {

    private final RegistrationService registrationService;
    private final IdempotencyService idempotencyService;

    @PostMapping
    @RateLimiter(name = "registration")
    public ResponseEntity<ApiResponse<RegistrationResponse>> register(
            @Valid @RequestBody RegistrationRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        Object cachedResponse = idempotencyService.getCachedResponse(idempotencyKey);
        if (cachedResponse != null) {
            return ResponseEntity.ok(ApiResponse.success((RegistrationResponse) cachedResponse));
        }
        
        RegistrationResponse response = registrationService.register(request, idempotencyKey);
        idempotencyService.cacheResponse(idempotencyKey, response);
        
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<RegistrationResponse>>> getMyRegistrations() {
        return ResponseEntity.ok(ApiResponse.success(registrationService.getMyRegistrations()));
    }

    @PostMapping("/{id}/payment/retry")
    public ResponseEntity<ApiResponse<RegistrationResponse>> retryPayment(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.retryPayment(id)));
    }
}

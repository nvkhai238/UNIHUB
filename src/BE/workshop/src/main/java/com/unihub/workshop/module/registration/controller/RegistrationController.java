package com.unihub.workshop.module.registration.controller;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.registration.dto.RegistrationQrResponse;
import com.unihub.workshop.module.registration.dto.RegistrationRequest;
import com.unihub.workshop.module.registration.dto.RegistrationResponse;
import com.unihub.workshop.module.registration.service.IdempotencyService;
import com.unihub.workshop.module.registration.service.RegistrationService;
import com.unihub.workshop.module.registration.service.StudentRegistrationLockService;
import com.unihub.workshop.module.registration.service.WorkshopSeatLockService;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/registrations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class RegistrationController {

    private final RegistrationService registrationService;
    private final IdempotencyService idempotencyService;
    private final StudentRegistrationLockService lockService;
    private final WorkshopSeatLockService workshopSeatLockService;

    @PostMapping
    @RateLimiter(name = "registration", fallbackMethod = "registrationRateLimitFallback")
    public ResponseEntity<ApiResponse<RegistrationResponse>> register(
            @Valid @RequestBody RegistrationRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication authentication
    ) {
        idempotencyService.validateKey(idempotencyKey);

        Optional<RegistrationResponse> cachedResponse = idempotencyService.getCachedRegistrationResponse(
                idempotencyKey,
                authentication.getName()
        );
        if (cachedResponse.isPresent()) {
            return ResponseEntity.ok()
                    .header("X-Idempotent-Replayed", "true")
                    .body(ApiResponse.success(cachedResponse.get()));
        }

        try (StudentRegistrationLockService.RegistrationLock lock =
                     lockService.acquire(authentication.getName(), request.getWorkshopId());
             WorkshopSeatLockService.WorkshopSeatLock seatLock =
                     workshopSeatLockService.acquire(request.getWorkshopId())) {
            if (!lock.isAcquired()) {
                throw new AppException(
                        ErrorCode.REGISTRATION_IN_PROGRESS,
                        "A registration request for this workshop is already being processed"
                );
            }
            if (!seatLock.isAcquired()) {
                throw new AppException(
                        ErrorCode.REGISTRATION_IN_PROGRESS,
                        "Workshop registration queue is busy. Please retry in a few seconds"
                );
            }

            RegistrationResponse response = registrationService.register(request, idempotencyKey);
            idempotencyService.cacheRegistrationResponse(idempotencyKey, authentication.getName(), response);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.<RegistrationResponse>builder()
                            .status(201)
                            .code("SUCCESS")
                            .message("Registration processed")
                            .data(response)
                            .build());
        }
    }

    public ResponseEntity<ApiResponse<RegistrationResponse>> registrationRateLimitFallback(
            RegistrationRequest request,
            String idempotencyKey,
            Authentication authentication,
            RequestNotPermitted ex
    ) {
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "10")
                .body(ApiResponse.error(
                        429,
                        "RATE_LIMIT_EXCEEDED",
                        "Quá nhiều yêu cầu. Vui lòng thử lại sau 10 giây."
                ));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<Page<RegistrationResponse>>> getMyRegistrations(
            @PageableDefault(size = 10, sort = "registeredAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.getMyRegistrations(pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RegistrationResponse>> getMyRegistration(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.getMyRegistration(id)));
    }

    @GetMapping("/{id}/qr")
    public ResponseEntity<ApiResponse<RegistrationQrResponse>> getMyQrCode(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.getMyQrCode(id)));
    }

    @PostMapping("/{id}/payment/retry")
    public ResponseEntity<ApiResponse<RegistrationResponse>> retryPayment(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        String retryKey = idempotencyService.generatePaymentRetryKey(id, authentication.getName());
        Optional<RegistrationResponse> cachedResponse = idempotencyService.getCachedRegistrationResponse(
                retryKey,
                authentication.getName()
        );
        if (cachedResponse.isPresent()) {
            return ResponseEntity.ok()
                    .header("X-Idempotent-Replayed", "true")
                    .body(ApiResponse.success(cachedResponse.get()));
        }

        RegistrationResponse response = registrationService.retryPayment(id);
        idempotencyService.cacheRegistrationResponse(retryKey, authentication.getName(), response);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<RegistrationResponse>> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Registration cancelled",
                registrationService.cancelMyRegistration(id)
        ));
    }
}

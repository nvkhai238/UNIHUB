package com.unihub.workshop.module.auth.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.auth.dto.AuthResponse;
import com.unihub.workshop.module.auth.dto.LoginRequest;
import com.unihub.workshop.module.auth.dto.OtpChallengeResponse;
import com.unihub.workshop.module.auth.dto.RefreshTokenRequest;
import com.unihub.workshop.module.auth.dto.RegisterRequest;
import com.unihub.workshop.module.auth.dto.RegisterOtpRequest;
import com.unihub.workshop.module.auth.dto.VerifyRegistrationOtpRequest;
import com.unihub.workshop.module.auth.service.AuthService;
import com.unihub.workshop.module.auth.service.RegistrationOtpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RegistrationOtpService registrationOtpService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(request)));
    }

    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request.getRefreshToken());
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.refresh(request.getRefreshToken())));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.register(request)));
    }

    @PostMapping("/register/request-otp")
    public ResponseEntity<ApiResponse<OtpChallengeResponse>> requestRegistrationOtp(
            @Valid @RequestBody RegisterOtpRequest request
    ) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.<OtpChallengeResponse>builder()
                        .status(202)
                        .code("OTP_REQUIRED")
                        .message("OTP has been sent to the provided email.")
                        .data(registrationOtpService.issueOtp(request))
                        .build());
    }

    @PostMapping("/register/verify-otp")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyRegistrationOtp(
            @Valid @RequestBody VerifyRegistrationOtpRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<AuthResponse>builder()
                        .status(201)
                        .code("SUCCESS")
                        .message("Registration completed")
                        .data(registrationOtpService.verifyOtpAndRegister(request.getEmail(), request.getOtpCode()))
                        .build());
    }
}

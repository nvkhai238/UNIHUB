package com.unihub.workshop.module.user.controller;

import com.unihub.workshop.common.response.ApiResponse;
import com.unihub.workshop.module.user.dto.UpdatePhoneRequest;
import com.unihub.workshop.module.user.dto.UpdateTelegramRequest;
import com.unihub.workshop.module.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PutMapping("/me/phone")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> updatePhone(
            Authentication authentication,
            @Valid @RequestBody UpdatePhoneRequest request
    ) {
        userService.updatePhone(authentication.getName(), request.getPhone());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/me/telegram")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> updateTelegram(
            Authentication authentication,
            @Valid @RequestBody UpdateTelegramRequest request
    ) {
        userService.updateTelegramId(authentication.getName(), request.getTelegramId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}

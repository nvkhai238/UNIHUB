package com.unihub.workshop.module.auth.dto;

import com.unihub.workshop.module.user.entity.UserRole;
import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Getter
@Builder
public class AuthResponse {
    private UUID userId;
    private String email;
    private String fullName;
    private UserRole role;
    private String accessToken;
    private String refreshToken;
}

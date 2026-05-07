package com.unihub.workshop.module.auth.dto;

import com.unihub.workshop.module.user.entity.UserRole;
import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Getter
@Builder
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    @Builder.Default
    private String tokenType = "Bearer";
    private long expiresIn;
    private UserDto user;

    @Getter
    @Builder
    public static class UserDto {
        private UUID id;
        private String email;
        private String fullName;
        private UserRole role;
    }
}

package com.unihub.workshop.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OtpChallengeResponse {
    private String email;
    private int expiresInSeconds;
    private String message;
}

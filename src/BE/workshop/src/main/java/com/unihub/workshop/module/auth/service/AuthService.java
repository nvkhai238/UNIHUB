package com.unihub.workshop.module.auth.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.auth.dto.AuthResponse;
import com.unihub.workshop.module.auth.dto.LoginRequest;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final StringRedisTemplate redisTemplate;

    private static final String REFRESH_TOKEN_PREFIX = "refresh_token:";
    private static final String BLACKLIST_PREFIX = "blacklist:";

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "Invalid email or password"));

        if (!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_NOT_ACTIVE);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.UNAUTHORIZED, "Invalid email or password");
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String accessToken = jwtService.generateToken(userDetails);
        String refreshToken = jwtService.generateRefreshToken(user.getEmail());

        redisTemplate.opsForValue().set(
                REFRESH_TOKEN_PREFIX + user.getEmail(),
                refreshToken,
                Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
        );

        return AuthResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }

    public void logout(String refreshToken) {
        if (!jwtService.isTokenValid(refreshToken)) {
            throw new AppException(ErrorCode.INVALID_TOKEN);
        }

        String email = jwtService.extractUsername(refreshToken);
        redisTemplate.delete(REFRESH_TOKEN_PREFIX + email);
        redisTemplate.opsForValue().set(
                BLACKLIST_PREFIX + refreshToken,
                "1",
                Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
        );
    }

    public AuthResponse refresh(String refreshToken) {
        if (!jwtService.isTokenValid(refreshToken)) {
            throw new AppException(ErrorCode.INVALID_TOKEN);
        }

        String isBlacklisted = redisTemplate.opsForValue().get(BLACKLIST_PREFIX + refreshToken);
        if (isBlacklisted != null) {
            throw new AppException(ErrorCode.INVALID_TOKEN, "Token has been revoked");
        }

        String email = jwtService.extractUsername(refreshToken);

        String storedToken = redisTemplate.opsForValue().get(REFRESH_TOKEN_PREFIX + email);
        if (!refreshToken.equals(storedToken)) {
            throw new AppException(ErrorCode.INVALID_TOKEN, "Refresh token mismatch");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_NOT_ACTIVE);
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        String newAccessToken = jwtService.generateToken(userDetails);
        String newRefreshToken = jwtService.generateRefreshToken(email);

        redisTemplate.delete(REFRESH_TOKEN_PREFIX + email);
        redisTemplate.opsForValue().set(
                REFRESH_TOKEN_PREFIX + email,
                newRefreshToken,
                Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
        );

        return AuthResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .build();
    }
}

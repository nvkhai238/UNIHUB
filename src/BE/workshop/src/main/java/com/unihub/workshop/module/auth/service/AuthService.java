package com.unihub.workshop.module.auth.service;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.DuplicateFieldException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.auth.dto.AuthResponse;
import com.unihub.workshop.module.auth.dto.LoginRequest;
import com.unihub.workshop.module.auth.dto.RegisterRequest;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;

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
        String accessToken = jwtService.generateToken(userDetails, Map.of("role", user.getRole().name()));
        String refreshToken = jwtService.generateRefreshToken(user.getEmail());

        try {
            redisTemplate.opsForValue().set(
                    REFRESH_TOKEN_PREFIX + user.getEmail(),
                    refreshToken,
                    Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
            );
        } catch (Exception e) {
            // Non-critical: Redis failure should not fail login.
        }

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtService.getAccessTokenTtlSeconds())
                .user(AuthResponse.UserDto.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .role(user.getRole())
                        .build())
                .build();
    }

    public void logout(String refreshToken) {
        if (!jwtService.isTokenValid(refreshToken)) {
            throw new AppException(ErrorCode.INVALID_TOKEN);
        }

        String email = jwtService.extractUsername(refreshToken);
        try {
            redisTemplate.delete(REFRESH_TOKEN_PREFIX + email);
            redisTemplate.opsForValue().set(
                    BLACKLIST_PREFIX + refreshToken,
                    "1",
                    Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
            );
        } catch (Exception e) {
            // Non-critical: Redis failure should not fail logout.
        }
    }

    public AuthResponse refresh(String refreshToken) {
        if (!jwtService.isTokenValid(refreshToken)) {
            throw new AppException(ErrorCode.INVALID_TOKEN);
        }

        String email = jwtService.extractUsername(refreshToken);

        try {
            String isBlacklisted = redisTemplate.opsForValue().get(BLACKLIST_PREFIX + refreshToken);
            if (isBlacklisted != null) {
                throw new AppException(ErrorCode.INVALID_TOKEN, "Token has been revoked");
            }

            String storedToken = redisTemplate.opsForValue().get(REFRESH_TOKEN_PREFIX + email);
            if (storedToken != null && !refreshToken.equals(storedToken)) {
                throw new AppException(ErrorCode.INVALID_TOKEN, "Refresh token mismatch");
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            // Non-critical: Redis failure should not fail token refresh.
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_NOT_ACTIVE);
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        String newAccessToken = jwtService.generateToken(userDetails, Map.of("role", user.getRole().name()));
        String newRefreshToken = jwtService.generateRefreshToken(email);

        try {
            redisTemplate.delete(REFRESH_TOKEN_PREFIX + email);
            redisTemplate.opsForValue().set(
                    REFRESH_TOKEN_PREFIX + email,
                    newRefreshToken,
                    Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
            );
        } catch (Exception e) {
            // Non-critical: Redis failure should not fail token refresh.
        }

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .expiresIn(jwtService.getAccessTokenTtlSeconds())
                .user(AuthResponse.UserDto.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .role(user.getRole())
                        .build())
                .build();
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateFieldException(
                ErrorCode.EMAIL_ALREADY_EXISTS,
                "email",
                "Email đã được sử dụng. Vui lòng sử dụng email khác hoặc đăng nhập."
            );
        }

        if (userRepository.existsByStudentId(request.getStudentId())) {
            throw new DuplicateFieldException(
                ErrorCode.STUDENT_ID_ALREADY_EXISTS,
                "studentId",
                "Mã số sinh viên đã được sử dụng. Nếu đã có tài khoản, vui lòng đăng nhập thay vì đăng ký lại."
            );
        }

        User user = User.builder()
                .email(request.getEmail())
                .studentId(request.getStudentId())
                .fullName(request.getFullName())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(UserRole.STUDENT)
                .isActive(true)
                .build();

        user = userRepository.save(user);

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String accessToken = jwtService.generateToken(userDetails, Map.of("role", user.getRole().name()));
        String refreshToken = jwtService.generateRefreshToken(user.getEmail());

        try {
            redisTemplate.opsForValue().set(
                    REFRESH_TOKEN_PREFIX + user.getEmail(),
                    refreshToken,
                    Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
            );
        } catch (Exception e) {
            // Non-critical: Redis failure should not fail registration.
            // Refresh token will be re-issued on next login if needed.
        }

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtService.getAccessTokenTtlSeconds())
                .user(AuthResponse.UserDto.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .role(user.getRole())
                        .build())
                .build();
    }
}

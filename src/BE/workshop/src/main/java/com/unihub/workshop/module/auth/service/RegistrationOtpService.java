package com.unihub.workshop.module.auth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.DuplicateFieldException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.auth.dto.AuthResponse;
import com.unihub.workshop.module.auth.dto.OtpChallengeResponse;
import com.unihub.workshop.module.auth.dto.RegisterOtpRequest;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.notification.service.EmailService;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RegistrationOtpService {

    private static final Duration OTP_TTL = Duration.ofMinutes(10);
    private static final String OTP_CODE_PREFIX = "auth:register:otp:";
    private static final String OTP_PAYLOAD_PREFIX = "auth:register:payload:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final EmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();

    public OtpChallengeResponse issueOtp(RegisterOtpRequest request) {
        validateUniqueness(request.getEmail(), request.getStudentId());
        if (!emailService.isEmailSendingAvailable()) {
            throw new AppException(ErrorCode.OTP_SEND_FAILED, "Email OTP chưa được cấu hình trên hệ thống.");
        }

        String normalizedEmail = normalizeEmail(request.getEmail());
        String otpCode = generateOtpCode();
        PendingRegistrationPayload payload = PendingRegistrationPayload.builder()
                .fullName(request.getFullName().trim())
                .email(normalizedEmail)
                .studentId(request.getStudentId().trim())
                .encodedPassword(passwordEncoder.encode(request.getPassword()))
                .build();

        try {
            redisTemplate.opsForValue().set(OTP_CODE_PREFIX + normalizedEmail, otpCode, OTP_TTL);
            redisTemplate.opsForValue().set(
                    OTP_PAYLOAD_PREFIX + normalizedEmail,
                    objectMapper.writeValueAsString(payload),
                    OTP_TTL
            );
        } catch (RedisConnectionFailureException | RedisSystemException e) {
            throw new AppException(ErrorCode.OTP_SEND_FAILED, "Không thể chuẩn bị phiên xác thực OTP lúc này.");
        } catch (JsonProcessingException e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Không thể lưu yêu cầu đăng ký chờ xác thực.");
        }

        emailService.sendRegistrationOtp(normalizedEmail, payload.getFullName(), otpCode, (int) OTP_TTL.toMinutes());

        return OtpChallengeResponse.builder()
                .email(normalizedEmail)
                .expiresInSeconds((int) OTP_TTL.toSeconds())
                .message("Mã OTP đã được gửi qua email. Vui lòng xác thực để hoàn tất đăng ký.")
                .build();
    }

    public AuthResponse verifyOtpAndRegister(String email, String otpCode) {
        String normalizedEmail = normalizeEmail(email);
        String storedOtp = readRedisValue(OTP_CODE_PREFIX + normalizedEmail);
        if (storedOtp == null) {
            throw new AppException(ErrorCode.OTP_EXPIRED, "Mã OTP đã hết hạn hoặc không tồn tại.");
        }
        if (!storedOtp.equals(otpCode)) {
            throw new AppException(ErrorCode.OTP_INVALID, "Mã OTP không chính xác.");
        }

        PendingRegistrationPayload payload = loadPayload(normalizedEmail);
        validateUniqueness(payload.getEmail(), payload.getStudentId());

        User user = User.builder()
                .email(payload.getEmail())
                .studentId(payload.getStudentId())
                .fullName(payload.getFullName())
                .password(payload.getEncodedPassword())
                .role(UserRole.STUDENT)
                .isActive(true)
                .build();
        user = userRepository.save(user);

        deleteRedisKey(OTP_CODE_PREFIX + normalizedEmail);
        deleteRedisKey(OTP_PAYLOAD_PREFIX + normalizedEmail);

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String accessToken = jwtService.generateToken(userDetails, Map.of("role", user.getRole().name()));
        String refreshToken = jwtService.generateRefreshToken(user.getEmail());

        try {
            redisTemplate.opsForValue().set(
                    "refresh_token:" + user.getEmail(),
                    refreshToken,
                    Duration.ofSeconds(jwtService.getRefreshTokenTtlSeconds())
            );
        } catch (RedisConnectionFailureException | RedisSystemException ignored) {
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

    private void validateUniqueness(String email, String studentId) {
        if (userRepository.existsByEmail(normalizeEmail(email))) {
            throw new DuplicateFieldException(
                    ErrorCode.EMAIL_ALREADY_EXISTS,
                    "email",
                    "Email đã được sử dụng. Vui lòng sử dụng email khác hoặc đăng nhập."
            );
        }
        if (userRepository.existsByStudentId(studentId.trim())) {
            throw new DuplicateFieldException(
                    ErrorCode.STUDENT_ID_ALREADY_EXISTS,
                    "studentId",
                    "Mã số sinh viên đã được sử dụng. Nếu đã có tài khoản, vui lòng đăng nhập thay vì đăng ký lại."
            );
        }
    }

    private PendingRegistrationPayload loadPayload(String normalizedEmail) {
        String rawPayload = readRedisValue(OTP_PAYLOAD_PREFIX + normalizedEmail);
        if (rawPayload == null) {
            throw new AppException(ErrorCode.OTP_EXPIRED, "Phiên đăng ký đã hết hạn. Vui lòng yêu cầu OTP lại.");
        }
        try {
            return objectMapper.readValue(rawPayload, PendingRegistrationPayload.class);
        } catch (JsonProcessingException e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR, "Không thể đọc dữ liệu đăng ký chờ xác thực.");
        }
    }

    private String readRedisValue(String key) {
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (RedisConnectionFailureException | RedisSystemException e) {
            throw new AppException(ErrorCode.OTP_SEND_FAILED, "Dịch vụ OTP tạm thời không khả dụng.");
        }
    }

    private void deleteRedisKey(String key) {
        try {
            redisTemplate.delete(key);
        } catch (RedisConnectionFailureException | RedisSystemException ignored) {
        }
    }

    private String generateOtpCode() {
        int value = secureRandom.nextInt(1_000_000);
        return "%06d".formatted(value);
    }

    private String normalizeEmail(String email) {
        return Optional.ofNullable(email)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .orElse("");
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    private static class PendingRegistrationPayload {
        private String fullName;
        private String email;
        private String studentId;
        private String encodedPassword;
    }
}

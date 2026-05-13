package com.unihub.workshop.module.auth;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.DuplicateFieldException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.auth.dto.AuthResponse;
import com.unihub.workshop.module.auth.dto.ChangePasswordRequest;
import com.unihub.workshop.module.auth.dto.LoginRequest;
import com.unihub.workshop.module.auth.dto.RegisterRequest;
import com.unihub.workshop.module.auth.service.AuthService;
import com.unihub.workshop.module.auth.service.CustomUserDetailsService;
import com.unihub.workshop.module.auth.service.JwtService;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthUnitTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private CustomUserDetailsService userDetailsService;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private AuthService authService;

    private User testUser;
    private UserDetails userDetails;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .email("test@test.edu.vn")
                .password("encoded_password")
                .fullName("Test User")
                .role(UserRole.STUDENT)
                .isActive(true)
                .build();
        testUser.setId(UUID.randomUUID());

        userDetails = mock(UserDetails.class);
    }

    @Test
    void login_Success() {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@test.edu.vn");
        request.setPassword("password");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches(request.getPassword(), testUser.getPassword())).thenReturn(true);
        when(userDetailsService.loadUserByUsername(testUser.getEmail())).thenReturn(userDetails);
        when(jwtService.generateToken(any(), any())).thenReturn("access_token");
        when(jwtService.generateRefreshToken(testUser.getEmail())).thenReturn("refresh_token");
        when(jwtService.getRefreshTokenTtlSeconds()).thenReturn(86400L);
        when(jwtService.getAccessTokenTtlSeconds()).thenReturn(3600L);
        
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        AuthResponse response = authService.login(request);

        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access_token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh_token");
        verify(valueOperations).set(eq("refresh_token:test@test.edu.vn"), eq("refresh_token"), any(Duration.class));
    }

    @Test
    void login_UserNotFound_ThrowsException() {
        LoginRequest request = new LoginRequest();
        request.setEmail("notfound@test.edu.vn");
        request.setPassword("password");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> authService.login(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    void login_WrongPassword_ThrowsException() {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@test.edu.vn");
        request.setPassword("wrongpassword");

        when(userRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches(request.getPassword(), testUser.getPassword())).thenReturn(false);

        AppException ex = assertThrows(AppException.class, () -> authService.login(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void register_Success() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("new@test.edu.vn");
        request.setStudentId("123456");
        request.setFullName("New User");
        request.setPassword("password");

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(userRepository.existsByStudentId(request.getStudentId())).thenReturn(false);
        when(passwordEncoder.encode(request.getPassword())).thenReturn("encoded_new");
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        
        when(userDetailsService.loadUserByUsername(request.getEmail())).thenReturn(userDetails);
        when(jwtService.generateToken(any(), any())).thenReturn("access_token");
        when(jwtService.generateRefreshToken(request.getEmail())).thenReturn("refresh_token");
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        AuthResponse response = authService.register(request);

        assertThat(response).isNotNull();
        verify(userRepository).save(any(User.class));
    }

    @Test
    void register_DuplicateEmail_ThrowsException() {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("test@test.edu.vn");

        when(userRepository.existsByEmail(request.getEmail())).thenReturn(true);

        DuplicateFieldException ex = assertThrows(DuplicateFieldException.class, () -> authService.register(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    @Test
    void changePassword_Success() {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword("oldpass");
        request.setNewPassword("newpass");

        SecurityContext securityContext = mock(SecurityContext.class);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("test@test.edu.vn");
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);

        when(userRepository.findByEmail("test@test.edu.vn")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("oldpass", testUser.getPassword())).thenReturn(true);
        when(passwordEncoder.matches("newpass", testUser.getPassword())).thenReturn(false);
        when(passwordEncoder.encode("newpass")).thenReturn("encoded_newpass");

        authService.changePassword(request);

        verify(userRepository).save(testUser);
        assertThat(testUser.getPassword()).isEqualTo("encoded_newpass");
        
        SecurityContextHolder.clearContext();
    }
}

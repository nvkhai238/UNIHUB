package com.unihub.workshop.module.registration;

import com.unihub.workshop.AbstractIntegrationTest;
import com.unihub.workshop.module.registration.dto.RegistrationRequest;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;

public class SystemProtectionIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private WorkshopRepository workshopRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RegistrationRepository registrationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Workshop workshop;
    private String studentToken;

    @BeforeEach
    void setUp() {
        registrationRepository.deleteAll();
        workshopRepository.deleteAll();
        userRepository.deleteAll();

        workshop = Workshop.builder()
                .title("Protection Workshop")
                .capacity(100)
                .remainingSeats(100)
                .price(BigDecimal.ZERO)
                .status(WorkshopStatus.PUBLISHED)
                .startTime(ZonedDateTime.now().plusDays(1))
                .build();
        workshop = workshopRepository.save(workshop);

        User student = User.builder()
                .email("student@test.edu.vn")
                .password(passwordEncoder.encode("password"))
                .fullName("Student")
                .role(UserRole.STUDENT)
                .build();
        userRepository.save(student);

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> loginResponse = restTemplate.postForEntity(
                "/api/auth/login",
                Map.of("email", "student@test.edu.vn", "password", "password"),
                com.unihub.workshop.common.response.ApiResponse.class
        );
        Map<String, Object> data = (Map<String, Object>) loginResponse.getBody().getData();
        studentToken = (String) data.get("accessToken");
    }

    @Test
    void idempotency_shouldReturnSameResponseForDuplicateRequests() {
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(workshop.getId());
        String idempotencyKey = UUID.randomUUID().toString();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(studentToken);
        headers.set("Idempotency-Key", idempotencyKey);
        HttpEntity<RegistrationRequest> entity = new HttpEntity<>(request, headers);

        // First request
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> response1 = 
                restTemplate.postForEntity("/api/registrations", entity, com.unihub.workshop.common.response.ApiResponse.class);
        assertThat(response1.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // Second request with same key
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> response2 = 
                restTemplate.postForEntity("/api/registrations", entity, com.unihub.workshop.common.response.ApiResponse.class);
        
        assertThat(response2.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response2.getHeaders().getFirst("X-Idempotent-Replayed")).isEqualTo("true");
        
        // Verify only 1 registration created
        assertThat(registrationRepository.count()).isEqualTo(1);
    }

    @Test
    void rateLimiting_shouldReturn429WhenLimitExceeded() {
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(workshop.getId());

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(studentToken);
        
        // Exceed the limit (configured as 5 per 10s in application.yml)
        for (int i = 0; i < 5; i++) {
            headers.set("Idempotency-Key", UUID.randomUUID().toString());
            restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headers), com.unihub.workshop.common.response.ApiResponse.class);
        }

        headers.set("Idempotency-Key", UUID.randomUUID().toString());
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> response = 
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headers), com.unihub.workshop.common.response.ApiResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst("Retry-After")).isNotNull();
    }
}

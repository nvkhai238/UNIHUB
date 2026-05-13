package com.unihub.workshop.module.security;

import com.unihub.workshop.AbstractIntegrationTest;
import com.unihub.workshop.module.user.entity.UserRole;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class SecurityIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String studentToken;
    private String organizerToken;
    private String checkinStaffToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        // Create Student
        User student = User.builder()
                .email("student@test.edu.vn")
                .password(passwordEncoder.encode("password"))
                .fullName("Student")
                .role(UserRole.STUDENT)
                .isActive(true)
                .build();
        userRepository.save(student);

        // Create Organizer
        User organizer = User.builder()
                .email("organizer@test.edu.vn")
                .password(passwordEncoder.encode("password"))
                .fullName("Organizer")
                .role(UserRole.ORGANIZER)
                .isActive(true)
                .build();
        userRepository.save(organizer);

        // Create Checkin Staff
        User checkinStaff = User.builder()
                .email("checkin@test.edu.vn")
                .password(passwordEncoder.encode("password"))
                .fullName("Checkin Staff")
                .role(UserRole.CHECKIN_STAFF)
                .isActive(true)
                .build();
        userRepository.save(checkinStaff);

        studentToken = login("student@test.edu.vn", "password");
        organizerToken = login("organizer@test.edu.vn", "password");
        checkinStaffToken = login("checkin@test.edu.vn", "password");
    }

    private String login(String email, String password) {
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> response = restTemplate.postForEntity(
                "/api/auth/login",
                Map.of("email", email, "password", password),
                com.unihub.workshop.common.response.ApiResponse.class
        );
        Map<String, Object> data = (Map<String, Object>) response.getBody().getData();
        return (String) data.get("accessToken");
    }

    @Test
    void student_CanAccessStudentEndpoints_CannotAccessAdminEndpoints() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(studentToken);
        HttpEntity<?> entity = new HttpEntity<>(headers);

        // Student endpoint - My Registrations
        ResponseEntity<String> res1 = restTemplate.exchange("/api/registrations/my", HttpMethod.GET, entity, String.class);
        assertThat(res1.getStatusCode()).isNotEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res1.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);

        // Admin endpoint - Workshop Management
        ResponseEntity<String> res2 = restTemplate.exchange("/api/admin/workshops", HttpMethod.GET, entity, String.class);
        assertThat(res2.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        
        // Checkin endpoint
        ResponseEntity<String> res3 = restTemplate.exchange("/api/checkin/sync", HttpMethod.POST, entity, String.class);
        assertThat(res3.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void organizer_CanAccessAdminEndpoints_CannotAccessCheckinEndpoints() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(organizerToken);
        HttpEntity<?> entity = new HttpEntity<>(headers);

        // Admin endpoint
        ResponseEntity<String> res1 = restTemplate.exchange("/api/admin/workshops", HttpMethod.GET, entity, String.class);
        assertThat(res1.getStatusCode()).isNotEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res1.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);

        // Checkin endpoint
        ResponseEntity<String> res2 = restTemplate.exchange("/api/checkin/sync", HttpMethod.POST, entity, String.class);
        assertThat(res2.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void checkinStaff_CanAccessCheckinEndpoints_CannotAccessAdminEndpoints() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(checkinStaffToken);
        HttpEntity<?> entity = new HttpEntity<>(headers);

        // Checkin endpoint
        ResponseEntity<String> res1 = restTemplate.exchange("/api/checkin/sync", HttpMethod.POST, entity, String.class);
        // Might be 400 Bad Request because of empty body, but not 403
        assertThat(res1.getStatusCode()).isNotEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res1.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);

        // Admin endpoint
        ResponseEntity<String> res2 = restTemplate.exchange("/api/admin/workshops", HttpMethod.GET, entity, String.class);
        assertThat(res2.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}

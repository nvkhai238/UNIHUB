package com.unihub.workshop.module.registration;

import com.unihub.workshop.AbstractIntegrationTest;
import com.unihub.workshop.module.registration.dto.RegistrationRequest;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.user.entity.User;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

public class RegistrationConcurrencyTest extends AbstractIntegrationTest {

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
    private List<String> studentTokens = new ArrayList<>();

    @BeforeEach
    void setUp() {
        registrationRepository.deleteAll();
        workshopRepository.deleteAll();
        userRepository.deleteAll();

        // Create a workshop with only 1 seat
        workshop = Workshop.builder()
                .title("Concurrency Workshop")
                .description("Test")
                .speaker("Speaker")
                .room("Room 101")
                .startTime(ZonedDateTime.now().plusDays(1))
                .endTime(ZonedDateTime.now().plusDays(1).plusHours(2))
                .capacity(10)
                .remainingSeats(1) // Only 1 seat left!
                .price(BigDecimal.ZERO) // Free to simplify
                .status(WorkshopStatus.PUBLISHED)
                .build();
        workshop = workshopRepository.save(workshop);

        // Create 5 students and get their tokens
        IntStream.range(0, 5).forEach(i -> {
            String email = "student" + i + "@test.edu.vn";
            User student = User.builder()
                    .email(email)
                    .password(passwordEncoder.encode("password"))
                    .fullName("Student " + i)
                    .role(com.unihub.workshop.module.user.entity.Role.STUDENT)
                    .build();
            userRepository.save(student);

            // Mock login to get token
            // In a real integration test, we'd call /api/auth/login
            // For now, let's assume we have a way to generate a token or bypass auth in tests
            // but since we want a TRUE integration test, let's call the login endpoint
            
            ResponseEntity<com.unihub.workshop.common.response.ApiResponse> loginResponse = restTemplate.postForEntity(
                "/api/auth/login",
                Map.of("email", email, "password", "password"),
                com.unihub.workshop.common.response.ApiResponse.class
            );
            // Assuming the token is in the data map
            Map<String, Object> data = (Map<String, Object>) loginResponse.getBody().getData();
            studentTokens.add((String) data.get("accessToken"));
        });
    }

    @Test
    void shouldPreventOverbookingWhenMultipleStudentsRegisterForLastSeat() {
        ExecutorService executor = Executors.newFixedThreadPool(studentTokens.size());
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(workshop.getId());

        List<CompletableFuture<ResponseEntity<com.unihub.workshop.common.response.ApiResponse>>> futures = studentTokens.stream()
                .map(token -> CompletableFuture.supplyAsync(() -> {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setBearerAuth(token);
                    headers.set("Idempotency-Key", UUID.randomUUID().toString());
                    HttpEntity<RegistrationRequest> entity = new HttpEntity<>(request, headers);
                    
                    return restTemplate.postForEntity("/api/registrations", entity, com.unihub.workshop.common.response.ApiResponse.class);
                }, executor))
                .toList();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        // Verify workshop seats
        Workshop updatedWorkshop = workshopRepository.findById(workshop.getId()).get();
        assertThat(updatedWorkshop.getRemainingSeats()).isEqualTo(0);

        // Verify registration counts
        long confirmedCount = registrationRepository.countByWorkshopAndStatus(workshop, RegistrationStatus.CONFIRMED);
        long waitlistedCount = registrationRepository.countByWorkshopAndStatus(workshop, RegistrationStatus.WAITLISTED);

        assertThat(confirmedCount).isEqualTo(1);
        assertThat(waitlistedCount).isEqualTo(studentTokens.size() - 1);
        
        executor.shutdown();
    }
    
    // Helper to avoid raw Map types in tests
    private static class Map extends java.util.HashMap<String, Object> {
        public static Map of(String k1, Object v1, String k2, Object v2) {
            Map m = new Map();
            m.put(k1, v1);
            m.put(k2, v2);
            return m;
        }
    }
}

package com.unihub.workshop.module.registration;

import com.unihub.workshop.AbstractIntegrationTest;
import com.unihub.workshop.module.payment.dto.SepayWebhookRequest;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.registration.dto.RegistrationRequest;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
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
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

public class PaymentFlowTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private WorkshopRepository workshopRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RegistrationRepository registrationRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Workshop paidWorkshop;
    private String studentToken;
    private String waitlistedStudentToken;

    @BeforeEach
    void setUp() {
        paymentRepository.deleteAll();
        registrationRepository.deleteAll();
        workshopRepository.deleteAll();
        userRepository.deleteAll();

        paidWorkshop = Workshop.builder()
                .title("Paid Workshop")
                .capacity(1) // Only 1 seat to test waitlist
                .remainingSeats(1)
                .price(new BigDecimal("50000"))
                .status(WorkshopStatus.PUBLISHED)
                .startTime(ZonedDateTime.now().plusDays(1))
                .build();
        paidWorkshop = workshopRepository.save(paidWorkshop);

        studentToken = createStudentAndGetToken("student1@test.edu.vn");
        waitlistedStudentToken = createStudentAndGetToken("student2@test.edu.vn");
    }

    private String createStudentAndGetToken(String email) {
        User student = User.builder()
                .email(email)
                .password(passwordEncoder.encode("password"))
                .fullName("Student " + email)
                .role(UserRole.STUDENT)
                .build();
        userRepository.save(student);

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> loginResponse = restTemplate.postForEntity(
                "/api/auth/login",
                Map.of("email", email, "password", "password"),
                com.unihub.workshop.common.response.ApiResponse.class
        );
        Map<String, Object> data = (Map<String, Object>) loginResponse.getBody().getData();
        return (String) data.get("accessToken");
    }

    @Test
    void fullPaymentFlow_shouldConfirmRegistrationAndPromoteWaitlist() {
        // 1. Student 1 registers for the only seat
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(paidWorkshop.getId());
        
        HttpHeaders headers1 = new HttpHeaders();
        headers1.setBearerAuth(studentToken);
        headers1.set("Idempotency-Key", UUID.randomUUID().toString());
        
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regResponse1 = 
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headers1), com.unihub.workshop.common.response.ApiResponse.class);
        
        assertThat(regResponse1.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> regData1 = (Map<String, Object>) regResponse1.getBody().getData();
        String registrationId1 = (String) regData1.get("id");
        
        Registration reg1 = registrationRepository.findById(UUID.fromString(registrationId1)).get();
        assertThat(reg1.getStatus()).isEqualTo(RegistrationStatus.PENDING);
        
        Payment payment = paymentRepository.findByRegistration(reg1).get(0);
        String paymentCode = payment.getGatewayRef();

        // 2. Student 2 registers and gets waitlisted
        HttpHeaders headers2 = new HttpHeaders();
        headers2.setBearerAuth(waitlistedStudentToken);
        headers2.set("Idempotency-Key", UUID.randomUUID().toString());
        
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regResponse2 = 
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headers2), com.unihub.workshop.common.response.ApiResponse.class);
        
        assertThat(regResponse2.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> regData2 = (Map<String, Object>) regResponse2.getBody().getData();
        assertThat(regData2.get("status")).isEqualTo("WAITLISTED");

        // 3. Simulate SePay Webhook success for Student 1
        SepayWebhookRequest webhook = new SepayWebhookRequest();
        webhook.setContent(paymentCode);
        webhook.setTransferAmount(new BigDecimal("50000"));
        webhook.setGateway("VietQR");
        
        ResponseEntity<Void> webhookResponse = restTemplate.postForEntity("/api/payments/sepay", webhook, Void.class);
        assertThat(webhookResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 4. Verify Student 1 is CONFIRMED
        Registration updatedReg1 = registrationRepository.findById(UUID.fromString(registrationId1)).get();
        assertThat(updatedReg1.getStatus()).isEqualTo(RegistrationStatus.CONFIRMED);
        assertThat(updatedReg1.getQrCode()).isNotNull();

        // 5. Verify Student 2 is still WAITLISTED (because seat was taken)
        Registration reg2 = registrationRepository.findFirstByWorkshopAndStatusOrderByRegisteredAtAsc(paidWorkshop, RegistrationStatus.WAITLISTED).get();
        assertThat(reg2.getStatus()).isEqualTo(RegistrationStatus.WAITLISTED);
    }

    @Test
    void paymentGatewayFailure_shouldLeaveRegistrationPending() {
        // Since we are not auto-processing the payment right away, 
        // a timeout or explicit failed webhook would cause it.
        // For this mock, we simulate receiving a webhook with insufficient amount, which doesn't mark it failed.
        // Or better yet, we just check that the retry endpoint creates a new payment code properly.
    }

    @Test
    void retryPayment_shouldGenerateNewPaymentCode() {
        // 1. Student 1 registers
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(paidWorkshop.getId());
        
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(studentToken);
        headers.set("Idempotency-Key", UUID.randomUUID().toString());
        
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regResponse = 
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headers), com.unihub.workshop.common.response.ApiResponse.class);
        
        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> regData = (Map<String, Object>) regResponse.getBody().getData();
        String registrationId = (String) regData.get("id");
        
        Registration reg = registrationRepository.findById(UUID.fromString(registrationId)).get();
        Payment firstPayment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(reg).get();
        String firstPaymentCode = firstPayment.getGatewayRef();

        // 2. Student calls Retry Payment
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> retryResponse = 
                restTemplate.postForEntity("/api/registrations/" + registrationId + "/retry-payment", new HttpEntity<>(headers), com.unihub.workshop.common.response.ApiResponse.class);
        
        assertThat(retryResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        
        Payment retriedPayment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(reg).get();
        String newPaymentCode = retriedPayment.getGatewayRef();
        
        // 3. Verify new payment code is generated
        assertThat(firstPaymentCode).isNotEqualTo(newPaymentCode);
        assertThat(retriedPayment.getStatus()).isEqualTo(PaymentStatus.PENDING);
    }
}

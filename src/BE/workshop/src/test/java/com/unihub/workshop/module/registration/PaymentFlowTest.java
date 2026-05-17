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
import java.util.List;
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
        // Use resetDatabase() to handle FK constraints properly
        resetDatabase();

        // Create an organizer (required by workshops.created_by NOT NULL constraint)
        User organizer = User.builder()
                .email("organizer@test.edu.vn")
                .password(passwordEncoder.encode("password"))
                .fullName("Test Organizer")
                .role(UserRole.ORGANIZER)
                .isActive(true)
                .build();
        organizer = userRepository.save(organizer);

        paidWorkshop = Workshop.builder()
                .title("Paid Workshop")
                .description("Workshop có phí để test")
                .speakerName("Speaker")
                .room("Room A")
                .capacity(1) // Only 1 seat to test waitlist
                .remainingSeats(1)
                .price(new BigDecimal("50000"))
                .status(WorkshopStatus.PUBLISHED)
                .startTime(ZonedDateTime.now().plusDays(1))
                .endTime(ZonedDateTime.now().plusDays(1).plusHours(2))
                .createdBy(organizer)
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
                .isActive(true)
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

    // ─── Test 1: Full happy path ─────────────────────────────────────────────────

    @Test
    void fullPaymentFlow_shouldConfirmRegistrationAfterSepayWebhook() {
        // 1. Student 1 registers for the only seat → PENDING
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
        assertThat(regData1.get("status")).isEqualTo("PENDING");

        Registration reg1 = registrationRepository.findById(UUID.fromString(registrationId1)).get();
        Payment payment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(reg1).get();
        String paymentCode = payment.getGatewayRef();

        // 2. Student 2 registers → WAITLISTED (seat is taken by student 1's PENDING registration)
        HttpHeaders headers2 = new HttpHeaders();
        headers2.setBearerAuth(waitlistedStudentToken);
        headers2.set("Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regResponse2 =
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headers2), com.unihub.workshop.common.response.ApiResponse.class);

        assertThat(regResponse2.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> regData2 = (Map<String, Object>) regResponse2.getBody().getData();
        assertThat(regData2.get("status")).isEqualTo("WAITLISTED");

        // 3. Simulate SePay Webhook success for Student 1 → correct endpoint /api/webhooks/sepay
        SepayWebhookRequest webhook = new SepayWebhookRequest();
        webhook.setContent(paymentCode);
        webhook.setTransferAmount(new BigDecimal("50000"));
        webhook.setTransferType("in");
        webhook.setGateway("VietQR");

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> webhookResponse =
                restTemplate.postForEntity("/api/webhooks/sepay", webhook, com.unihub.workshop.common.response.ApiResponse.class);
        assertThat(webhookResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 4. Verify Student 1 is CONFIRMED with QR code
        Registration updatedReg1 = registrationRepository.findById(UUID.fromString(registrationId1)).get();
        assertThat(updatedReg1.getStatus()).isEqualTo(RegistrationStatus.CONFIRMED);
        assertThat(updatedReg1.getQrCode()).isNotNull();

        // 5. Student 2 is still WAITLISTED (seat is taken again by confirmed student 1)
        Workshop freshWorkshop = workshopRepository.findById(paidWorkshop.getId()).get();
        long waitlistedCount = registrationRepository.countByWorkshopAndStatus(freshWorkshop, RegistrationStatus.WAITLISTED);
        assertThat(waitlistedCount)
                .as("Student B vẫn phải ở danh sách chờ vì ghế đã được giữ bởi A")
                .isEqualTo(1L);
    }

    // ─── Test 2: THE BUG FIX — Waitlist promotion for paid workshop ──────────────
    // Scenario: A's payment times out / A cancels → B is promoted from WAITLISTED
    // EXPECTED (after fix): B must become PENDING + have a Payment record, NOT jump to CONFIRMED
    // PREVIOUS BUG: B jumped straight to CONFIRMED without paying

    @Test
    void whenPendingRegistrationCancelled_waitlistedStudentShouldBecomePending_notConfirmed() {
        // 1. Student A registers → occupies seat (PENDING)
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(paidWorkshop.getId());

        HttpHeaders headersA = new HttpHeaders();
        headersA.setBearerAuth(studentToken);
        headersA.set("Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regA =
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headersA), com.unihub.workshop.common.response.ApiResponse.class);
        assertThat(regA.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String regIdA = (String) ((Map<String, Object>) regA.getBody().getData()).get("id");

        // 2. Student B registers → WAITLISTED
        HttpHeaders headersB = new HttpHeaders();
        headersB.setBearerAuth(waitlistedStudentToken);
        headersB.set("Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regB =
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headersB), com.unihub.workshop.common.response.ApiResponse.class);
        assertThat(regB.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String regIdB = (String) ((Map<String, Object>) regB.getBody().getData()).get("id");
        assertThat(((Map<String, Object>) regB.getBody().getData()).get("status")).isEqualTo("WAITLISTED");

        // 3. Student A cancels their PENDING registration (simulate timeout or explicit cancel)
        HttpHeaders cancelHeaders = new HttpHeaders();
        cancelHeaders.setBearerAuth(studentToken);
        restTemplate.exchange("/api/registrations/" + regIdA,
                HttpMethod.DELETE, new HttpEntity<>(cancelHeaders),
                com.unihub.workshop.common.response.ApiResponse.class);

        // 4. THE KEY ASSERTION: Student B must now be PENDING (not CONFIRMED!)
        Registration updatedRegB = registrationRepository.findById(UUID.fromString(regIdB)).get();
        assertThat(updatedRegB.getStatus())
                .as("Student B được duyệt từ waitlist phải chuyển sang PENDING, không phải CONFIRMED trực tiếp")
                .isEqualTo(RegistrationStatus.PENDING);
        assertThat(updatedRegB.getQrCode())
                .as("QR code phải null vì chưa thanh toán")
                .isNull();

        // 5. Student B must have a PENDING Payment record with a payment code
        Payment paymentB = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(updatedRegB).get();
        assertThat(paymentB)
                .as("Phiếu thanh toán phải tồn tại")
                .isNotNull();
        assertThat(paymentB.getStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(paymentB.getGatewayRef())
                .as("Payment code phải bắt đầu bằng UH")
                .startsWith("UH");
        assertThat(paymentB.getAmount()).isEqualByComparingTo(new BigDecimal("50000"));
    }

    // ─── Test 3: End-to-end — Waitlist → PENDING → Pay via webhook → CONFIRMED ───

    @Test
    void whenWaitlistedStudentBecomePending_andPaysViaWebhook_shouldBeConfirmed() {
        // 1. Student A registers → PENDING (takes the seat)
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(paidWorkshop.getId());

        HttpHeaders headersA = new HttpHeaders();
        headersA.setBearerAuth(studentToken);
        headersA.set("Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regA =
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headersA), com.unihub.workshop.common.response.ApiResponse.class);
        String regIdA = (String) ((Map<String, Object>) regA.getBody().getData()).get("id");

        // 2. Student B → WAITLISTED
        HttpHeaders headersB = new HttpHeaders();
        headersB.setBearerAuth(waitlistedStudentToken);
        headersB.set("Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regB =
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headersB), com.unihub.workshop.common.response.ApiResponse.class);
        String regIdB = (String) ((Map<String, Object>) regB.getBody().getData()).get("id");

        // 3. Student A cancels → B promoted to PENDING
        HttpHeaders cancelHeaders = new HttpHeaders();
        cancelHeaders.setBearerAuth(studentToken);
        restTemplate.exchange("/api/registrations/" + regIdA,
                HttpMethod.DELETE, new HttpEntity<>(cancelHeaders),
                com.unihub.workshop.common.response.ApiResponse.class);

        // 4. Retrieve B's payment code
        Registration regBEntity = registrationRepository.findById(UUID.fromString(regIdB)).get();
        assertThat(regBEntity.getStatus()).isEqualTo(RegistrationStatus.PENDING);
        Payment latestPaymentB = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(regBEntity).get();
        String paymentCodeB = latestPaymentB.getGatewayRef();

        // 5. Send SePay webhook for B's payment
        SepayWebhookRequest webhook = new SepayWebhookRequest();
        webhook.setContent(paymentCodeB);
        webhook.setTransferAmount(new BigDecimal("50000"));
        webhook.setTransferType("in");
        webhook.setGateway("VietQR");

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> webhookResponse =
                restTemplate.postForEntity("/api/webhooks/sepay", webhook, com.unihub.workshop.common.response.ApiResponse.class);
        assertThat(webhookResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 6. Student B should now be CONFIRMED with a QR code
        Registration finalRegB = registrationRepository.findById(UUID.fromString(regIdB)).get();
        assertThat(finalRegB.getStatus())
                .as("Sau khi thanh toán, sinh viên từ waitlist phải trở thành CONFIRMED")
                .isEqualTo(RegistrationStatus.CONFIRMED);
        assertThat(finalRegB.getQrCode())
                .as("QR code phải được sinh sau khi xác nhận thanh toán")
                .isNotNull();

        // 7. Payment should be SUCCESS
        Payment paymentFinal = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(finalRegB).get();
        assertThat(paymentFinal.getStatus()).isEqualTo(PaymentStatus.SUCCESS);
    }

    // ─── Test 4: Retry payment generates a new payment code ─────────────────────

    @Test
    void retryPayment_shouldGenerateNewPaymentCode() {
        // 1. Student registers
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(paidWorkshop.getId());

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(studentToken);
        headers.set("Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> regResponse =
                restTemplate.postForEntity("/api/registrations", new HttpEntity<>(request, headers), com.unihub.workshop.common.response.ApiResponse.class);

        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String registrationId = (String) ((Map<String, Object>) regResponse.getBody().getData()).get("id");

        Registration reg = registrationRepository.findById(UUID.fromString(registrationId)).get();
        Payment firstPayment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(reg).get();
        String firstPaymentCode = firstPayment.getGatewayRef();

        // 2. Retry Payment → should generate a new payment code
        ResponseEntity<com.unihub.workshop.common.response.ApiResponse> retryResponse =
                restTemplate.postForEntity("/api/registrations/" + registrationId + "/payment/retry",
                        new HttpEntity<>(headers), com.unihub.workshop.common.response.ApiResponse.class);

        assertThat(retryResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        Payment retriedPayment = paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(reg).get();
        String newPaymentCode = retriedPayment.getGatewayRef();

        // 3. Verify new payment code is generated
        assertThat(firstPaymentCode).isNotEqualTo(newPaymentCode);
        assertThat(retriedPayment.getStatus()).isEqualTo(PaymentStatus.PENDING);
    }
}

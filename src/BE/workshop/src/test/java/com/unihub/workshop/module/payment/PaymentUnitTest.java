package com.unihub.workshop.module.payment;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.module.payment.client.MockPaymentGatewayClient;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.entity.PaymentStatus;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.service.PaymentService;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PaymentUnitTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private MockPaymentGatewayClient paymentGatewayClient;
    @Mock
    private RegistrationRepository registrationRepository;
    @Mock
    private WorkshopRepository workshopRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private PaymentService paymentService;

    private User testUser;
    private Registration testRegistration;
    private Payment testPayment;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .email("student@test.edu.vn")
                .build();
        testUser.setId(UUID.randomUUID());

        Workshop testWorkshop = Workshop.builder().title("Test Workshop").build();
        testWorkshop.setId(UUID.randomUUID());

        testRegistration = Registration.builder()
                .user(testUser)
                .workshop(testWorkshop)
                .build();
        testRegistration.setId(UUID.randomUUID());

        testPayment = Payment.builder()
                .registration(testRegistration)
                .amount(BigDecimal.valueOf(100000))
                .gatewayRef("REF123")
                .status(PaymentStatus.PENDING)
                .build();
        testPayment.setId(UUID.randomUUID());

        SecurityContext securityContext = mock(SecurityContext.class);
        Authentication authentication = mock(Authentication.class);
        lenient().when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);

        lenient().when(authentication.getName()).thenReturn("student@test.edu.vn");
        lenient().when(userRepository.findByEmail("student@test.edu.vn")).thenReturn(Optional.of(testUser));
    }

    @Test
    void processPayment_Success() {
        when(paymentGatewayClient.processPayment(testPayment.getGatewayRef(), testPayment.getAmount())).thenReturn(PaymentStatus.SUCCESS);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));

        Payment result = paymentService.processPayment(testPayment);

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.SUCCESS);
        assertThat(result.getGatewayResponse()).contains("SUCCESS");
        verify(paymentRepository).save(testPayment);
    }

    @Test
    void processPayment_ThrowsException_SetsStatusFailed() {
        when(paymentGatewayClient.processPayment(testPayment.getGatewayRef(), testPayment.getAmount()))
                .thenThrow(new RuntimeException("Gateway Error"));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));

        RuntimeException ex = assertThrows(RuntimeException.class, () -> paymentService.processPayment(testPayment));
        assertThat(ex.getMessage()).isEqualTo("Gateway Error");
        assertThat(testPayment.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(testPayment.getGatewayResponse()).contains("Gateway Error");
    }

    @Test
    void getPaymentStatus_Success() {
        when(registrationRepository.findById(testRegistration.getId())).thenReturn(Optional.of(testRegistration));
        when(paymentRepository.findTopByRegistrationOrderByCreatedAtDesc(testRegistration)).thenReturn(Optional.of(testPayment));

        var response = paymentService.getPaymentStatus(testRegistration.getId());

        assertThat(response).isNotNull();
        assertThat(response.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
    }

    @Test
    void getPaymentStatus_NotYourRegistration_ThrowsForbidden() {
        User otherUser = User.builder().build();
        otherUser.setId(UUID.randomUUID());
        testRegistration.setUser(otherUser);

        when(registrationRepository.findById(testRegistration.getId())).thenReturn(Optional.of(testRegistration));

        AppException ex = assertThrows(AppException.class, () -> paymentService.getPaymentStatus(testRegistration.getId()));
        assertThat(ex.getErrorCode().name()).isEqualTo("FORBIDDEN");
    }
}

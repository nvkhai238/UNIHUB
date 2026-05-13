package com.unihub.workshop.module.registration;

import com.unihub.workshop.common.exception.AppException;
import com.unihub.workshop.common.exception.ErrorCode;
import com.unihub.workshop.module.notification.service.NotificationService;
import com.unihub.workshop.module.payment.entity.Payment;
import com.unihub.workshop.module.payment.repository.PaymentRepository;
import com.unihub.workshop.module.payment.service.PaymentProcessorService;
import com.unihub.workshop.module.registration.dto.RegistrationRequest;
import com.unihub.workshop.module.registration.dto.RegistrationResponse;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.registration.service.QrCodeService;
import com.unihub.workshop.module.registration.service.RegistrationService;
import com.unihub.workshop.module.user.entity.User;
import com.unihub.workshop.module.user.repository.UserRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.entity.WorkshopStatus;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RegistrationUnitTest {

    @Mock
    private RegistrationRepository registrationRepository;
    @Mock
    private WorkshopRepository workshopRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private PaymentProcessorService paymentProcessorService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private QrCodeService qrCodeService;
    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private RegistrationService registrationService;

    private User testUser;
    private Workshop testWorkshop;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .email("student@test.edu.vn")
                .fullName("Student")
                .build();
        testUser.setId(UUID.randomUUID());

        testWorkshop = Workshop.builder()
                .title("Test Workshop")
                .capacity(100)
                .remainingSeats(100)
                .price(BigDecimal.ZERO)
                .status(WorkshopStatus.PUBLISHED)
                .startTime(ZonedDateTime.now().plusDays(1))
                .build();
        testWorkshop.setId(UUID.randomUUID());

        SecurityContext securityContext = mock(SecurityContext.class);
        Authentication authentication = mock(Authentication.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);
        
        // leniency for when() not used in some tests
        lenient().when(authentication.getName()).thenReturn("student@test.edu.vn");
        lenient().when(userRepository.findByEmail("student@test.edu.vn")).thenReturn(Optional.of(testUser));
    }

    @Test
    void register_FreeWorkshop_Success() {
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(testWorkshop.getId());

        when(workshopRepository.findByIdForUpdate(testWorkshop.getId())).thenReturn(Optional.of(testWorkshop));
        when(registrationRepository.existsByUserAndWorkshopAndStatusNot(testUser, testWorkshop, RegistrationStatus.CANCELLED)).thenReturn(false);
        when(registrationRepository.findByUserAndWorkshop(testUser, testWorkshop)).thenReturn(Optional.empty());
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> {
            Registration r = i.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });
        lenient().when(qrCodeService.generateDataUri(any())).thenReturn("data:image/png;base64,...");

        RegistrationResponse response = registrationService.register(request, "key1");

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(RegistrationStatus.CONFIRMED);
        assertThat(testWorkshop.getRemainingSeats()).isEqualTo(99);
        verify(workshopRepository).save(testWorkshop);
    }

    @Test
    void register_NoSeats_Waitlisted() {
        testWorkshop.setRemainingSeats(0);
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(testWorkshop.getId());

        when(workshopRepository.findByIdForUpdate(testWorkshop.getId())).thenReturn(Optional.of(testWorkshop));
        when(registrationRepository.existsByUserAndWorkshopAndStatusNot(testUser, testWorkshop, RegistrationStatus.CANCELLED)).thenReturn(false);
        when(registrationRepository.findByUserAndWorkshop(testUser, testWorkshop)).thenReturn(Optional.empty());
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> {
            Registration r = i.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });

        RegistrationResponse response = registrationService.register(request, "key2");

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(RegistrationStatus.WAITLISTED);
        assertThat(testWorkshop.getRemainingSeats()).isEqualTo(0);
    }

    @Test
    void register_PaidWorkshop_PendingPayment() {
        testWorkshop.setPrice(BigDecimal.valueOf(100000));
        RegistrationRequest request = new RegistrationRequest();
        request.setWorkshopId(testWorkshop.getId());

        when(workshopRepository.findByIdForUpdate(testWorkshop.getId())).thenReturn(Optional.of(testWorkshop));
        when(registrationRepository.existsByUserAndWorkshopAndStatusNot(testUser, testWorkshop, RegistrationStatus.CANCELLED)).thenReturn(false);
        when(registrationRepository.findByUserAndWorkshop(testUser, testWorkshop)).thenReturn(Optional.empty());
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> {
            Registration r = i.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> {
            Payment p = i.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        RegistrationResponse response = registrationService.register(request, "key3");

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(RegistrationStatus.PENDING);
    }

    @Test
    void cancelMyRegistration_Success() {
        Registration registration = Registration.builder()
                .user(testUser)
                .workshop(testWorkshop)
                .status(RegistrationStatus.CONFIRMED)
                .build();
        registration.setId(UUID.randomUUID());

        when(registrationRepository.findById(registration.getId())).thenReturn(Optional.of(registration));
        when(workshopRepository.findByIdForUpdate(testWorkshop.getId())).thenReturn(Optional.of(testWorkshop));
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        RegistrationResponse response = registrationService.cancelMyRegistration(registration.getId());

        assertThat(response.getStatus()).isEqualTo(RegistrationStatus.CANCELLED);
        verify(workshopRepository).save(testWorkshop);
        assertThat(testWorkshop.getRemainingSeats()).isEqualTo(100); // Capacity is 100, remaining was 100, returned 1 seat = 100.
    }
}

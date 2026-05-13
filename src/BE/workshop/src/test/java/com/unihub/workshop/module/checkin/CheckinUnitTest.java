package com.unihub.workshop.module.checkin;

import com.unihub.workshop.module.checkin.dto.SyncRequest;
import com.unihub.workshop.module.checkin.dto.SyncResponse;
import com.unihub.workshop.module.checkin.entity.Checkin;
import com.unihub.workshop.module.checkin.repository.CheckinRepository;
import com.unihub.workshop.module.checkin.service.CheckinService;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import com.unihub.workshop.module.workshop.entity.Workshop;
import com.unihub.workshop.module.workshop.repository.WorkshopRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CheckinUnitTest {

    @Mock
    private CheckinRepository checkinRepository;
    @Mock
    private RegistrationRepository registrationRepository;
    @Mock
    private WorkshopRepository workshopRepository;

    @InjectMocks
    private CheckinService checkinService;

    private Registration testRegistration;
    private SyncRequest syncRequest;

    @BeforeEach
    void setUp() {
        testRegistration = Registration.builder()
                .id(UUID.randomUUID())
                .qrCode("VALID_QR")
                .status(RegistrationStatus.CONFIRMED)
                .build();

        syncRequest = new SyncRequest();
        syncRequest.setQrCode("VALID_QR");
        syncRequest.setDeviceId("device1");
        syncRequest.setTimestamp(ZonedDateTime.now());
    }

    @Test
    void syncCheckins_ValidQr_CreatesCheckin() {
        when(registrationRepository.findByQrCode("VALID_QR")).thenReturn(Optional.of(testRegistration));
        when(checkinRepository.findByRegistration(testRegistration)).thenReturn(Optional.empty());

        SyncResponse response = checkinService.syncCheckins(List.of(syncRequest));

        assertThat(response.getCreated()).isEqualTo(1);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo("CREATED");
        verify(checkinRepository).save(any(Checkin.class));
    }

    @Test
    void syncCheckins_InvalidQr_ReturnsInvalid() {
        syncRequest.setQrCode("INVALID_QR");
        when(registrationRepository.findByQrCode("INVALID_QR")).thenReturn(Optional.empty());

        SyncResponse response = checkinService.syncCheckins(List.of(syncRequest));

        assertThat(response.getInvalid()).isEqualTo(1);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo("INVALID_QR");
        verify(checkinRepository, never()).save(any(Checkin.class));
    }

    @Test
    void syncCheckins_NotConfirmed_ReturnsInvalid() {
        testRegistration.setStatus(RegistrationStatus.PENDING);
        when(registrationRepository.findByQrCode("VALID_QR")).thenReturn(Optional.of(testRegistration));

        SyncResponse response = checkinService.syncCheckins(List.of(syncRequest));

        assertThat(response.getInvalid()).isEqualTo(1);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo("NOT_CONFIRMED");
    }

    @Test
    void syncCheckins_DuplicateSameDevice_ReturnsDuplicate() {
        Checkin existingCheckin = Checkin.builder()
                .registration(testRegistration)
                .deviceId("device1")
                .build();

        when(registrationRepository.findByQrCode("VALID_QR")).thenReturn(Optional.of(testRegistration));
        when(checkinRepository.findByRegistration(testRegistration)).thenReturn(Optional.of(existingCheckin));

        SyncResponse response = checkinService.syncCheckins(List.of(syncRequest));

        assertThat(response.getDuplicate()).isEqualTo(1);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo("DUPLICATE");
    }

    @Test
    void syncCheckins_ConflictDifferentDevice_ReturnsConflict() {
        Checkin existingCheckin = Checkin.builder()
                .registration(testRegistration)
                .deviceId("device2")
                .build();

        when(registrationRepository.findByQrCode("VALID_QR")).thenReturn(Optional.of(testRegistration));
        when(checkinRepository.findByRegistration(testRegistration)).thenReturn(Optional.of(existingCheckin));

        SyncResponse response = checkinService.syncCheckins(List.of(syncRequest));

        assertThat(response.getConflict()).isEqualTo(1);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo("CONFLICT");
    }
}

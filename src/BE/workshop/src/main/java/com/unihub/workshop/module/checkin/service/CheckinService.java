package com.unihub.workshop.module.checkin.service;

import com.unihub.workshop.module.checkin.dto.PreloadResponse;
import com.unihub.workshop.module.checkin.dto.SyncRequest;
import com.unihub.workshop.module.checkin.entity.Checkin;
import com.unihub.workshop.module.checkin.repository.CheckinRepository;
import com.unihub.workshop.module.registration.entity.Registration;
import com.unihub.workshop.module.registration.entity.RegistrationStatus;
import com.unihub.workshop.module.registration.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CheckinService {

    private final CheckinRepository checkinRepository;
    private final RegistrationRepository registrationRepository;

    @Transactional(readOnly = true)
    public List<PreloadResponse> preloadCheckins(LocalDate date) {
        ZonedDateTime startOfDay = date.atStartOfDay(ZoneId.systemDefault());
        ZonedDateTime endOfDay = startOfDay.plusDays(1).minusNanos(1);

        List<Registration> registrations = registrationRepository.findByStatusAndWorkshop_StartTimeBetween(
                RegistrationStatus.CONFIRMED, startOfDay, endOfDay);

        return registrations.stream()
                .map(r -> PreloadResponse.builder()
                        .qrCode(r.getQrCode())
                        .fullName(r.getUser().getFullName())
                        .workshopId(r.getWorkshop().getId())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void syncCheckins(List<SyncRequest> records) {
        for (SyncRequest record : records) {
            Optional<Registration> registrationOpt = registrationRepository.findByQrCode(record.getQrCode());
            if (registrationOpt.isPresent()) {
                Registration registration = registrationOpt.get();
                if (!checkinRepository.existsByRegistration(registration)) {
                    Checkin checkin = Checkin.builder()
                            .registration(registration)
                            .checkedInAt(record.getTimestamp())
                            .syncedAt(ZonedDateTime.now())
                            .deviceId(record.getDeviceId())
                            .build();
                    checkinRepository.save(checkin);
                }
            }
        }
    }
}
